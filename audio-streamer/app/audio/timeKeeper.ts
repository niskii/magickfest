export class TimeKeeper {
  #audioContext: AudioContext;
  #startedAt: number;
  #totalTimeScheduled: number;
  #totalDuration: number;
  #startPosition: number;
  #offset: number;

  constructor(audioContext: AudioContext) {
    this.#audioContext = audioContext;
    this.#startedAt = 0.0;
    this.#totalTimeScheduled = 0.0;
    this.#offset = 0.0;
  }

  setStartedAt(startedAt: number) {
    this.#startedAt = startedAt;
  }

  setTotalTimeScheduled(totalTimeScheduled) {
    this.#totalTimeScheduled = totalTimeScheduled;
  }

  setTotalDuration(totalDuration: number) {
    this.#totalDuration = totalDuration;
  }

  setStartPosition(startPosition) {
    this.#startPosition = startPosition;
  }

  getTotalDuration() {
    return this.#totalDuration;
  }

  getRemainingTime() {
    return (
      this.#totalTimeScheduled -
      (this.#audioContext.currentTime - this.#startedAt)
    );
  }

  getCurrentPlayPosition() {
    return (
      this.#audioContext.currentTime -
      this.#startedAt +
      this.#startPosition +
      this.#offset
    );
  }

  getRemainingAudio() {
    return this.#totalDuration - this.getCurrentPlayPosition();
  }

  addDelay(delay) {
    this.#offset = delay;
  }

  getCurrentTime() {
    return this.#audioContext.currentTime;
  }
}
