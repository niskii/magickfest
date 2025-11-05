import { Socket } from "socket.io-client";
import { SocketAudioStream } from "./socket-audio-stream";
import { TimeKeeper } from "./timeKeeper";
import * as decoder from "./decoder-service";

export class AudioStreamPlayer {
  // these shouldn't change once set
  _socket: Socket;
  _readBufferSize;

  // these are reset
  _sessionId; // used to prevent race conditions between cancel/starts
  _audioCtx: AudioContext; // Created/Closed when this player starts/stops audio
  _stream: SocketAudioStream;
  _timeKeeper: TimeKeeper;
  _audioSrcNodes; // Used to fix Safari Bug https://github.com/AnthumChris/fetch-stream-audio/issues/1
  _totalTimeScheduled; // time scheduled of all AudioBuffers
  _playStartedAt; // audioContext.currentTime of first sched
  _abCreated; // AudioBuffers created
  _abEnded; // AudioBuffers played/ended
  _skips; // audio skipping caused by slow download
  _flushTimeoutId;
  _hasFlushed;

  onUpdateState;

  constructor(socket: Socket, readBufferSize, decoderName) {
    switch (decoderName) {
      case "OPUS":
        break;
      default:
        throw Error("Unsupported decoderName", decoderName);
    }

    decoder.handlers.onDecode = this._onDecode.bind(this);

    // pause for now
    // this._audioCtx.suspend().then(_ => console.log('audio paused'));

    this._socket = socket;
    this._readBufferSize = readBufferSize;
    this._reset();
  }

  _reset() {
    if (this._stream) this._stream.reset();
    delete this._stream;
    this._stream = null;
    this._socket.removeListener("chunk");

    if (this._sessionId) {
      performance.clearMarks(this._downloadMarkKey);
    }
    this._sessionId = null;
    this._audioCtx = null;
    this._audioSrcNodes = [];
    this._totalTimeScheduled = 0;
    this._playStartedAt = 0;
    this._abCreated = 0;
    this._abEnded = 0;
    this._skips = 0;
  }

  close() {
    for (const node of this._audioSrcNodes) {
      node.onended = null;
      node.disconnect(this._audioCtx.destination);
      node.stop();
    }
    if (this._stream) {
      this._stream.reset();
    }
    if (this._audioCtx) {
      this._audioCtx.suspend();
      this._audioCtx.close();
    }

    this._reset();
  }

  start() {
    this._sessionId = performance.now();
    performance.mark(this._downloadMarkKey);
    this._audioCtx = new window.AudioContext();
    this._timeKeeper = new TimeKeeper(this._audioCtx);
    const stream = new SocketAudioStream(this._socket, this._timeKeeper, 10);
    // stream.onFetch = this._downloadProgress.bind(this);
    stream.onFetch = this._decode.bind(this);
    stream.onFlush = this._flush.bind(this);

    this._stream = stream;

    stream.start().catch((e) => {
      this._updateState({ error: e.toString() });
    });

    this.resume();
  }

  pause() {
    this._audioCtx
      .suspend()
      .then((_) => this._updateState({ playState: "paused" }));
  }
  resume() {
    this._audioCtx
      .resume()
      .then((_) => this._updateState({ playState: "playing" }));
  }

  _updateState(props) {
    const abState = !this._abCreated
      ? {}
      : {
          abCreated: this._abCreated,
          abEnded: this._abEnded,
          abRemaining: this._abCreated - this._abEnded,
          skips: this._skips,
        };
    const state = Object.assign(abState, props);
    if (this.onUpdateState) {
      this.onUpdateState(state);
    }
  }

  _flush() {
    const timeout = this._timeKeeper.getRemainingTime();

    this._flushTimeoutId = setTimeout(() => {
      decoder.flushAudio();
    }, timeout);
  }

  async _decode(buffer: ArrayBuffer) {
    const sessionId = this._sessionId;
    decoder.decodeAudio(buffer, sessionId);

    this._hasFlushed = false;
    clearTimeout(this._flushTimeoutId);
  }

  // prevent race condition by checking sessionId
  _onDecode(event) {
    if (event.decoded.channelData) {
      if (!(this._sessionId && this._sessionId === event.sessionId)) {
        console.log("race condition detected for closed session");
        return;
      }

      this._schedulePlayback(event.decoded);
    }
  }

  _downloadProgress({ bytes, totalRead, totalBytes, done }) {
    this._updateState({
      bytesRead: totalRead,
      bytesTotal: totalBytes,
      dlRate:
        (totalRead * 8) / (performance.now() - this._getDownloadStartTime()),
    });
    // console.log(done, (totalRead/totalBytes*100).toFixed(2) );
  }

  get _downloadMarkKey() {
    return `download-start-${this._sessionId}`;
  }
  _getDownloadStartTime() {
    return performance.getEntriesByName(this._downloadMarkKey)[0].startTime;
  }

  _getRemainingTime() {
    return Math.max(
      0.0,
      this._totalTimeScheduled -
        (this._audioCtx.currentTime - this._playStartedAt),
    );
  }

  _schedulePlayback({ channelData, length, numberOfChannels, sampleRate }) {
    const audioSrc = this._audioCtx.createBufferSource(),
      audioBuffer = this._audioCtx.createBuffer(
        numberOfChannels,
        length,
        sampleRate,
      );

    audioSrc.onended = () => {
      this._audioSrcNodes.shift();
      this._abEnded++;
      this._updateState({});
    };
    this._abCreated++;
    this._updateState({});

    // adding also ensures onended callback is fired in Safari
    this._audioSrcNodes.push(audioSrc);

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
    if (!this._playStartedAt) {
      /* this clips in Firefox, plays */
      // const startDelay = audioCtx.baseLatency || (128 / audioCtx.sampleRate);

      /* this doesn't clip in Firefox (256 value), plays */
      // startDelay = this._audioCtx.baseLatency || (256 / this._audioCtx.sampleRate);

      // 100ms allows enough time for largest 60ms Opus frame to decode

      startDelay = 100 / 1000;

      /* this could be useful for firefox but outputLatency is about 250ms in FF. too long */
      // const startDelay = audioCtx.outputLatency || audioCtx.baseLatency || (128 / audioCtx.sampleRate);

      this._playStartedAt = this._audioCtx.currentTime + startDelay;
      this._timeKeeper.setStartedAt(this._playStartedAt);
      this._updateState({
        latency:
          performance.now() - this._getDownloadStartTime() + startDelay * 1000,
      });
    }

    audioSrc.buffer = audioBuffer;
    audioSrc.connect(this._audioCtx.destination);

    const startAt = Math.max(
      this._audioCtx.currentTime,
      this._playStartedAt + this._totalTimeScheduled,
    ); // play at current time if underflowing
    if (this._audioCtx.currentTime >= startAt) {
      this._skips++;
      this._updateState({});
    }

    audioSrc.start(startAt);

    this._totalTimeScheduled += audioBuffer.duration;
    this._timeKeeper.setTotalTimeScheduled(this._totalTimeScheduled);
  }
}
