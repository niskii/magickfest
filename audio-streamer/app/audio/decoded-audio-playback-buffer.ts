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
  static maxFlushSize = 1024 * 128;

  // exponentially grow over these many flushes
  // too small causes skips. 25 skips at 72kbps download, 64-kbit file
  static maxGrows = 50;

  // samples for for first flush. grow from here. 20ms @ 48,000 hz
  static firstFlushLength = 0.02 * 48000;

  // expoonential grow coefficient from firstFlushLength samples to maxFlushSize bytes
  // Floating point is 4 bytes per sample
  static growFactor = Math.pow(
    DecodedAudioPlaybackBuffer.maxFlushSize /
      4 /
      DecodedAudioPlaybackBuffer.firstFlushLength,
    1 / (DecodedAudioPlaybackBuffer.maxGrows - 1),
  );

  static flushLength = (flushCount) => {
    const flushes = Math.min(
      flushCount,
      DecodedAudioPlaybackBuffer.maxGrows - 1,
    );
    const multiplier = Math.pow(DecodedAudioPlaybackBuffer.growFactor, flushes);
    const length = Math.round(
      DecodedAudioPlaybackBuffer.firstFlushLength * multiplier,
    );
    return length;
  };

  // left/right channels of buffers we're filling
  #bufferL = new Float32Array(DecodedAudioPlaybackBuffer.maxFlushSize);
  #bufferR = new Float32Array(DecodedAudioPlaybackBuffer.maxFlushSize);

  #bufferPos; // last filled position in buffer
  #onFlush; // user-provided function
  #flushCount; // number of times we've already flushed

  constructor({ onFlush }) {
    if (typeof onFlush !== "function")
      throw Error("onFlush must be a function");

    this.#onFlush = onFlush;
    this.reset();
  }

  reset() {
    this.#bufferPos = 0;
    this.#flushCount = 0;
  }

  add({ left, right }) {
    const srcLen = left.length;
    let bufferLen,
      srcStart = 0,
      bufferPos = this.#bufferPos;

    while (srcStart < srcLen) {
      bufferLen = DecodedAudioPlaybackBuffer.flushLength(this.#flushCount);
      const len = Math.min(bufferLen - bufferPos, srcLen - srcStart);
      const end = srcStart + len;
      this.#bufferL.set(left.slice(srcStart, end), bufferPos);
      this.#bufferR.set(right.slice(srcStart, end), bufferPos);
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
    });
    this.#flushCount++;
    this.#bufferPos = 0;
  }
}
