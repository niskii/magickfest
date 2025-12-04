import { Bitrate } from "@shared/types/audio-transfer";
import { Socket } from "socket.io-client";
import type { ChanneledAudioBuffer } from "./AudioTypes";
import * as decoder from "./decoder-service";
import { SocketAudioStream } from "./socket-audio-stream";
import { TimeKeeper } from "./time-keeper";

export class AudioStreamPlayer {
  #stream: SocketAudioStream;
  #sessionId: number; // used to prevent race conditions between cancel/starts
  #audioCtx: AudioContext; // Created/Closed when this player starts/stops audio
  #audioSrcNodes: Array<AudioBufferSourceNode>; // Used to fix Safari Bug https://github.com/AnthumChris/fetch-stream-audio/issues/1
  #gainNode: GainNode;
  #timeKeeper: TimeKeeper;
  #flushTimeoutId: NodeJS.Timeout;
  #bitrate: Bitrate;
  #volume: number;
  #analyzer: AnalyserNode;

  constructor(socket: Socket, bitrate: Bitrate, volume: number) {
    decoder.handlers.onDecode = this.#onDecode.bind(this);
    this.#bitrate = bitrate;
    this.#volume = volume;

    this.#timeKeeper = new TimeKeeper();

    const stream = new SocketAudioStream(
      socket,
      this.#timeKeeper,
      this.#bitrate,
    );
    stream.onFetch = this.#decode.bind(this);
    stream.onFlush = this.#flush.bind(this);
    this.#stream = stream;

    this.reset();
  }

  setBitrate(bitrate: Bitrate) {
    this.#bitrate = bitrate;
    if (this.#stream) this.#stream.setBitrate(bitrate);
  }

  setVolume(volume: number) {
    this.#volume = volume;
    this.#gainNode.gain.value = volume;
  }

  getAnalyzer() {
    return this.#analyzer;
  }

  reset() {
    this.#stream.reset();
    this.#timeKeeper.reset();
    decoder.clear();

    if (this.#sessionId) {
      performance.clearMarks(this.downloadMarkKey);
    }

    this.#sessionId = null;
    if (this.#audioCtx) {
      this.#audioCtx.suspend();
      this.#audioCtx.close();
    }
    this.#audioCtx = null;
    this.#audioSrcNodes = [];
  }

  close() {
    this.#flush();

    this.#stream.reset();
    this.#stream = null;

    for (const node of this.#audioSrcNodes) {
      node.onended = null;
      node.disconnect(this.#audioCtx.destination);
      node.stop();
    }

    if (this.#audioCtx) {
      this.#audioCtx.suspend();
      this.#audioCtx.close();
    }
  }

  start() {
    this.#sessionId = performance.now();
    performance.mark(this.downloadMarkKey);
    this.#audioCtx = new window.AudioContext();
    this.#gainNode = this.#audioCtx.createGain();
    this.#analyzer = this.#audioCtx.createAnalyser();
    this.#gainNode.gain.value = this.#volume;
    this.#audioCtx.suspend();

    this.#timeKeeper.setAudioContext(this.#audioCtx);
    this.#stream.start();
  }

  pause() {
    this.#audioCtx.suspend();
  }
  resume() {
    this.#audioCtx.resume();
  }

  getCurrentPlayPosition() {
    return this.#timeKeeper.getCurrentPlayPosition();
  }

  getTotalDuration() {
    return this.#timeKeeper.getTotalDuration();
  }

  getDownloadedAudioTime() {
    return this.#timeKeeper.getDownloadedAudioDuration();
  }

  getServerDelay() {
    return this.#timeKeeper.getDelay();
  }

  #flush() {
    this.#flushTimeoutId = setTimeout(() => {
      decoder.flushAudio();
    }, 100);
  }

  #decode(buffer: Uint8Array<ArrayBufferLike>) {
    decoder.decodeAudio(buffer, this.#sessionId);
    clearTimeout(this.#flushTimeoutId);
  }

  // prevent race condition by checking sessionId
  #onDecode(event: any) {
    if (event.decoded.channelData) {
      if (!(this.#sessionId && this.#sessionId === event.sessionId)) {
        console.log("race condition detected for closed session");
        return;
      }

      this.resume();
      this.#schedulePlayback(event.decoded);
    }
  }

  get downloadMarkKey() {
    return `download-start-${this.#sessionId}`;
  }

  #schedulePlayback({
    channelData,
    length,
    numberOfChannels,
    sampleRate,
  }: ChanneledAudioBuffer) {
    const audioSrc = this.#audioCtx.createBufferSource(),
      audioBuffer = this.#audioCtx.createBuffer(
        numberOfChannels,
        length,
        sampleRate,
      );

    audioSrc.onended = () => {
      this.#audioSrcNodes.shift();

      if (
        this.#audioCtx.currentTime >
        this.#timeKeeper.getStartedAt() +
          this.#timeKeeper.getTotalTimeScheduled()
      ) {
        this.pause();
      }
    };

    // adding also ensures onended callback is fired in Safari
    this.#audioSrcNodes.push(audioSrc);

    // Use performant copyToChannel() if browser supports it
    for (let c = 0; c < numberOfChannels; c++) {
      if (audioBuffer.copyToChannel) {
        audioBuffer.copyToChannel(channelData[c], c);
      } else {
        const toChannel = audioBuffer.getChannelData(c);
        for (let i = 0; i < channelData[c].byteLength; i++) {
          toChannel[i] = channelData[c][i];
        }
      }
    }

    let startDelay = 0;
    // initialize first play position.  initial clipping/choppiness sometimes occurs and intentional start latency needed
    // read more: https://github.com/WebAudio/web-audio-api/issues/296#issuecomment-257100626
    if (!this.#timeKeeper.getStartedAt()) {
      /* this clips in Firefox, plays */
      // const startDelay = audioCtx.baseLatency || (128 / audioCtx.sampleRate);

      /* this doesn't clip in Firefox (256 value), plays */
      // startDelay = this._audioCtx.baseLatency || (256 / this._audioCtx.sampleRate);

      // 100ms allows enough time for largest 60ms Opus frame to decode

      startDelay = 100 / 1000;

      /* this could be useful for firefox but outputLatency is about 250ms in FF. too long */
      // const startDelay = audioCtx.outputLatency || audioCtx.baseLatency || (128 / audioCtx.sampleRate);

      this.#timeKeeper.setStartedAt(this.#audioCtx.currentTime + startDelay);
    }

    audioSrc.buffer = audioBuffer;
    audioSrc.connect(this.#gainNode);
    this.#gainNode.connect(this.#analyzer);
    this.#gainNode.connect(this.#audioCtx.destination);
    // audioSrc.connect(this.#audioCtx.destination);

    const startAt = Math.max(
      this.#audioCtx.currentTime,
      this.#timeKeeper.getStartedAt() +
        this.#timeKeeper.getTotalTimeScheduled(),
    ); // play at current time if underflowing

    audioSrc.start(startAt);
    this.#timeKeeper.addTotalTimeScheduled(audioBuffer.duration);
  }
}
