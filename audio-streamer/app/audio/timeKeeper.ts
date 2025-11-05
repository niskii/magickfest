export class TimeKeeper {
  audioContext: AudioContext;
  startedAt: number;
  totalTimeScheduled: number;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.startedAt = 0.0;
    this.totalTimeScheduled = 0.0;
  }

  setStartedAt(startedAt: number) {
    this.startedAt = startedAt;
  }

  setTotalTimeScheduled(totalTimeScheduled) {
    this.totalTimeScheduled = totalTimeScheduled;
  }

  getRemainingTime() {
    return (
      this.totalTimeScheduled - (this.audioContext.currentTime - this.startedAt)
    );
  }
}
