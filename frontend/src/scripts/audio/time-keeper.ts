export class TimeKeeper {
  #audioContext: AudioContext;
  #startedAt: number;
  #totalTimeScheduled: number;
  #totalDuration: number;
  #startPosition: number;
  #delay: number;

  constructor(audioContext: AudioContext) {
    this.#audioContext = audioContext;
    this.#startedAt = 0.0;
    this.#totalTimeScheduled = 0.0;
    this.#totalDuration = 0.0;
    this.#delay = 0.0;
  }

  setStartedAt(startedAt: number) {
    this.#startedAt = startedAt;
  }

  setTotalTimeScheduled(totalTimeScheduled: number) {
    this.#totalTimeScheduled = totalTimeScheduled;
  }

  setTotalDuration(totalDuration: number) {
    this.#totalDuration = totalDuration;
  }

  setStartPosition(startPosition: number) {
    this.#startPosition = startPosition;
  }

  getTotalDuration() {
    return this.#totalDuration;
  }

  getDownloadedAudioDuration() {
    if (!this.#audioContext) return 0.0;

    return (
      this.#totalTimeScheduled -
      (this.#audioContext.currentTime - this.#startedAt)
    );
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

  getRemainingAudio() {
    return this.#totalDuration - this.getCurrentPlayPosition();
  }

  addDelay(delay: number) {
    this.#delay = delay;
  }

  getDelay() {
    return this.#delay;
  }

  getCurrentTime() {
    return this.#audioContext.currentTime;
  }
}
