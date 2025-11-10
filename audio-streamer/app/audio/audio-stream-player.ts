import { Socket } from "socket.io-client";
import { SocketAudioStream } from "./socket-audio-stream";
import { TimeKeeper } from "./time-keeper";
import * as decoder from "./decoder-service";

import config from "../../config/client.json";

export class AudioStreamPlayer {
  // these shouldn't change once set
  #socket: Socket;

  // these are reset
  #sessionId; // used to prevent race conditions between cancel/starts
  #audioCtx: AudioContext; // Created/Closed when this player starts/stops audio
  #stream: SocketAudioStream;
  #timeKeeper: TimeKeeper;
  #audioSrcNodes; // Used to fix Safari Bug https://github.com/AnthumChris/fetch-stream-audio/issues/1
  #totalTimeScheduled; // time scheduled of all AudioBuffers
  #playStartedAt; // audioContext.currentTime of first sched
  #flushTimeoutId;
  #bitrate;

  constructor(socket: Socket, bitrate: number) {
    decoder.handlers.onDecode = this.#onDecode.bind(this);
    this.#bitrate = bitrate;

    this.#socket = socket;
    this.reset();
  }

  setBitrate(bitrate: number) {
    this.#bitrate = bitrate;
    if (this.#stream) this.#stream.setBitrate(bitrate);
  }

  reset() {
    if (this.#stream) this.#stream.reset();
    this.#stream = null;

    if (this.#sessionId) {
      performance.clearMarks(this.downloadMarkKey);
    }
    this.#sessionId = null;
    this.#audioCtx = null;
    this.#audioSrcNodes = [];
    this.#totalTimeScheduled = 0;
    this.#playStartedAt = 0;
  }

  close() {
    this.#flush();

    for (const node of this.#audioSrcNodes) {
      node.onended = null;
      node.disconnect(this.#audioCtx.destination);
      node.stop();
    }
    if (this.#stream) {
      this.#stream.reset();
    }
    if (this.#audioCtx) {
      this.#audioCtx.suspend();
      this.#audioCtx.close();
    }

    this.reset();
  }

  start() {
    this.#sessionId = performance.now();
    performance.mark(this.downloadMarkKey);
    this.#audioCtx = new window.AudioContext();
    this.#audioCtx.suspend();

    this.#timeKeeper = new TimeKeeper(this.#audioCtx);

    const stream = new SocketAudioStream(
      this.#socket,
      this.#timeKeeper,
      this.#bitrate,
    );
    stream.onFetch = this.#decode.bind(this);
    stream.onFlush = this.#flush.bind(this);
    this.#stream = stream;

    stream.start();
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

  #flush() {
    const timeout = this.#timeKeeper.getDownloadedAudioDuration();

    this.#flushTimeoutId = setTimeout(() => {
      decoder.flushAudio();
    }, timeout);
  }

  #decode(buffer: ArrayBuffer) {
    decoder.decodeAudio(buffer, this.#sessionId);
    clearTimeout(this.#flushTimeoutId);
  }

  // prevent race condition by checking sessionId
  #onDecode(event) {
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

  #getDownloadStartTime() {
    return performance.getEntriesByName(this.downloadMarkKey)[0].startTime;
  }

  #schedulePlayback({ channelData, length, numberOfChannels, sampleRate }) {
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
        this.#playStartedAt + this.#totalTimeScheduled
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
    if (!this.#playStartedAt) {
      /* this clips in Firefox, plays */
      // const startDelay = audioCtx.baseLatency || (128 / audioCtx.sampleRate);

      /* this doesn't clip in Firefox (256 value), plays */
      // startDelay = this._audioCtx.baseLatency || (256 / this._audioCtx.sampleRate);

      // 100ms allows enough time for largest 60ms Opus frame to decode

      startDelay = 100 / 1000;

      /* this could be useful for firefox but outputLatency is about 250ms in FF. too long */
      // const startDelay = audioCtx.outputLatency || audioCtx.baseLatency || (128 / audioCtx.sampleRate);

      this.#playStartedAt = this.#audioCtx.currentTime + startDelay;
      this.#timeKeeper.setStartedAt(this.#playStartedAt);
    }

    audioSrc.buffer = audioBuffer;
    audioSrc.connect(this.#audioCtx.destination);

    const startAt = Math.max(
      this.#audioCtx.currentTime,
      this.#playStartedAt + this.#totalTimeScheduled,
    ); // play at current time if underflowing

    audioSrc.start(startAt);

    this.#totalTimeScheduled += audioBuffer.duration;
    this.#timeKeeper.setTotalTimeScheduled(this.#totalTimeScheduled);
  }
}
