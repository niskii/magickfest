import type { DecodedAudioBuffer } from "./AudioTypes";

/* This solves https://github.com/AnthumChris/fetch-stream-audio/issues/11
 *
 * Controls decoded audio playback by filling a buffer and
 * flushing.  Assumes each sample is 4 bytes (float).
 * Grows exponentally to faciliate less-needed immediacy of playback and
 * fewer AudioBuffer objects created.
 * maxFlushSize and maxGrows are most likely the vals to tweak
 */
export class DecodedAudioPlaybackBuffer {
  // use a 128K buffer
  readonly maxFlushSize = 1024 * 128;

  // exponentially grow over these many flushes
  // too small causes skips. 25 skips at 72kbps download, 64-kbit file
  readonly maxGrows = 50;

  // samples for for first flush. grow from here. 20ms @ 48,000 hz
  readonly firstFlushLength = 0.02 * 48000;

  // expoonential grow coefficient from firstFlushLength samples to maxFlushSize bytes
  // Floating point is 4 bytes per sample
  readonly growFactor = Math.pow(
    this.maxFlushSize / 4 / this.firstFlushLength,
    1 / (this.maxGrows - 1),
  );

  flushLength(flushCount: number) {
    const flushes = Math.min(flushCount, this.maxGrows - 1);
    const multiplier = Math.pow(this.growFactor, flushes);
    const length = Math.round(this.firstFlushLength * multiplier);
    return length;
  }

  // left/right channels of buffers we're filling
  #bufferL = new Float32Array(this.maxFlushSize);
  #bufferR = new Float32Array(this.maxFlushSize);

  #bufferPos: number; // last filled position in buffer
  #flushCount: number; // number of times we've already flushed
  #onFlush: (buffer: DecodedAudioBuffer) => void; // user-provided function

  constructor(onFlush: (buffer: DecodedAudioBuffer) => void) {
    if (typeof onFlush !== "function")
      throw Error("onFlush must be a function");

    this.#onFlush = onFlush;
    this.reset();
  }

  reset() {
    this.#bufferPos = 0;
    this.#flushCount = 0;
  }

  add(buffer: DecodedAudioBuffer) {
    const srcLen = buffer.left.length;
    let bufferLen,
      srcStart = 0,
      bufferPos = this.#bufferPos;

    while (srcStart < srcLen) {
      bufferLen = this.flushLength(this.#flushCount);
      const len = Math.min(bufferLen - bufferPos, srcLen - srcStart);
      const end = srcStart + len;
      this.#bufferL.set(buffer.left.slice(srcStart, end), bufferPos);
      this.#bufferR.set(buffer.right.slice(srcStart, end), bufferPos);
      srcStart += len;
      bufferPos += len;
      this.#bufferPos = bufferPos;
      if (bufferPos === bufferLen) {
        this.flush();
        bufferPos = 0;
      }
    }
    return true;
  }

  flush() {
    const bufferPos = this.#bufferPos;
    this.#onFlush({
      left: this.#bufferL.slice(0, bufferPos),
      right: this.#bufferR.slice(0, bufferPos),
      samplesDecoded: bufferPos,
      sampleRate: 48000,
    });
    this.#flushCount++;
    this.#bufferPos = 0;
  }
}
