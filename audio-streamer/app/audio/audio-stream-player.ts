import { Socket } from "socket.io-client";
import { SocketAudioStream } from "./socket-audio-stream";
import { TimeKeeper } from "./timeKeeper";
import * as decoder from "./decoder-service";

export class AudioStreamPlayer {
  // these shouldn't change once set
  #socket: Socket;
  #maxBufferSize;

  // these are reset
  #sessionId; // used to prevent race conditions between cancel/starts
  #audioCtx: AudioContext; // Created/Closed when this player starts/stops audio
  #stream: SocketAudioStream;
  #timeKeeper: TimeKeeper;
  #audioSrcNodes; // Used to fix Safari Bug https://github.com/AnthumChris/fetch-stream-audio/issues/1
  #totalTimeScheduled; // time scheduled of all AudioBuffers
  #playStartedAt; // audioContext.currentTime of first sched
  skips; // audio skipping caused by slow download
  #flushTimeoutId;

  onUpdateState;

  constructor(socket: Socket, maxBufferSize, decoderName) {
    switch (decoderName) {
      case "OPUS":
        break;
      default:
        throw Error("Unsupported decoderName", decoderName);
    }

    decoder.handlers.onDecode = this.#onDecode.bind(this);

    // pause for now
    // this._audioCtx.suspend().then(_ => console.log('audio paused'));

    this.#socket = socket;
    this.#maxBufferSize = maxBufferSize;
    this.reset();
  }

  reset() {
    if (this.#stream) this.#stream.reset();
    this.#stream = null;
    this.#socket.removeListener("fetch");
    this.#socket.removeListener("sync");

    if (this.#sessionId) {
      performance.clearMarks(this._downloadMarkKey);
    }
    this.#sessionId = null;
    this.#audioCtx = null;
    this.#audioSrcNodes = [];
    this.#totalTimeScheduled = 0;
    this.#playStartedAt = 0;
    this.skips = 0;
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
    performance.mark(this._downloadMarkKey);
    this.#audioCtx = new window.AudioContext();
    this.#audioCtx.suspend()
    this.#timeKeeper = new TimeKeeper(this.#audioCtx);
    const stream = new SocketAudioStream(
      this.#socket,
      this.#timeKeeper,
      this.#maxBufferSize,
    );
    stream.onFetch = this.#decode.bind(this);
    stream.onFlush = this.#flush.bind(this);
    this.#stream = stream;



    stream.start().catch((e) => {
      this.#updateState({ error: e.toString() });
    });
  }

  pause() {
    this.#audioCtx
      .suspend()
      .then((_) => this.#updateState({ playState: "paused" }));
  }
  resume() {
    this.#audioCtx
      .resume()
      .then((_) => this.#updateState({ playState: "playing" }));
  }

  getCurrentPlayPosition() {
    return this.#timeKeeper.getCurrentPlayPosition();
  }

  getTotalDuration() {
    return this.#timeKeeper.getTotalDuration();
  }

  #updateState(props) {
    const abState = {
      skips: this.skips,
    };
    const state = Object.assign(abState, props);
    if (this.onUpdateState) {
      this.onUpdateState(state);
    }
  }

  #flush() {
    const timeout = this.#timeKeeper.getRemainingTime();

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

  #downloadProgress({ bytes, totalRead, totalBytes, done }) {
    this.#updateState({
      bytesRead: totalRead,
      bytesTotal: totalBytes,
      dlRate:
        (totalRead * 8) / (performance.now() - this.#getDownloadStartTime()),
    });
    // console.log(done, (totalRead/totalBytes*100).toFixed(2) );
  }

  get _downloadMarkKey() {
    return `download-start-${this.#sessionId}`;
  }

  #getDownloadStartTime() {
    return performance.getEntriesByName(this._downloadMarkKey)[0].startTime;
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
      this.#updateState({});

      if (
        this.#audioCtx.currentTime >
        this.#playStartedAt + this.#totalTimeScheduled
      ) {
        this.pause();
      }
    };
    this.#updateState({});

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
      this.#updateState({
        latency:
          performance.now() - this.#getDownloadStartTime() + startDelay * 1000,
      });
    }

    audioSrc.buffer = audioBuffer;
    audioSrc.connect(this.#audioCtx.destination);

    const startAt = Math.max(
      this.#audioCtx.currentTime,
      this.#playStartedAt + this.#totalTimeScheduled,
    ); // play at current time if underflowing
    if (this.#audioCtx.currentTime >= startAt) {
      this.skips++;
      this.#updateState({});
    }
    audioSrc.start(startAt);

    this.#totalTimeScheduled += audioBuffer.duration;
    this.#timeKeeper.setTotalTimeScheduled(this.#totalTimeScheduled);
  }
}
