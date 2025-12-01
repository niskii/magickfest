export class TimeKeeper {
  #audioContext: AudioContext;
  #startedAt: number;
  #totalTimeScheduled: number;
  #totalDuration: number;
  #startPosition: number;
  #delay: number;

  constructor() {
    this.reset();
  }

  reset() {
    this.#startedAt = 0.0;
    this.#totalTimeScheduled = 0.0;
    this.#totalDuration = 0.0;
    this.#startPosition = 0.0;
    this.#delay = 0.0;
  }

  addTotalTimeScheduled(duration: number) {
    this.#totalTimeScheduled += duration;
  }

  addDelay(delay: number) {
    this.#delay = delay;
  }

  getCurrentPlayPosition() {
    if (!this.#audioContext) return 0.0;

    return (
      this.#audioContext.currentTime -
      this.#startedAt +
      this.#startPosition +
      this.#delay
    );
  }

  getCurrentTime() {
    return this.#audioContext.currentTime;
  }

  getDelay() {
    return this.#delay;
  }

  getDownloadedAudioDuration() {
    if (!this.#audioContext) return 0.0;

    return (
      this.#totalTimeScheduled -
      (this.#audioContext.currentTime - this.#startedAt)
    );
  }

  getRemainingAudio() {
    return this.#totalDuration - this.getCurrentPlayPosition();
  }

  getStartedAt() {
    return this.#startedAt;
  }

  getTotalDuration() {
    return this.#totalDuration;
  }

  getTotalTimeScheduled() {
    return this.#totalTimeScheduled;
  }

  setAudioContext(audioContext: AudioContext) {
    this.#audioContext = audioContext;
  }

  setStartedAt(startedAt: number) {
    this.#startedAt = startedAt;
  }

  setStartPosition(startPosition: number) {
    this.#startPosition = startPosition;
  }

  setTotalTimeScheduled(totalTimeScheduled: number) {
    this.#totalTimeScheduled = totalTimeScheduled;
  }

  setTotalDuration(totalDuration: number) {
    this.#totalDuration = totalDuration;
  }
}
