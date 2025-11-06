import EventEmitter from "node:events";
import { OpusReader } from "./opus-reader";
import { Playlist } from "./playlist";

export class Player {
  #opusReader: OpusReader | null = null;
  #startTime: number | null = null;
  #playbackTimer: NodeJS.Timeout | null = null;
  #playlist;
  events: EventEmitter | undefined;

  constructor(playlist: Playlist) {
    this.#playlist = playlist;

    this.events = new EventEmitter();
    if (this.events === undefined) {
      throw new Error("Could not create EventEmitter!");
    }
  }

  getState() {
    return {
      id: this.#playlist.getHash(),
      setIndex: this.#playlist.getCurrentSet(),
      startTime: this.#startTime,
    };
  }

  setState(setIndex: number, startTime: number) {
    this.#playlist.setCurrentSet(setIndex);
    this.playAt(startTime);
  }

  playAt(startTime: number) {
    this.#playbackTimer?.close();
    const set = this.#playlist.getCurrentSet();
    this.#opusReader = new OpusReader(set.File);
    this.#opusReader.setClock(startTime);
    this.#startTime = this.#opusReader.getClock();
    this.#setupPlaybackTimer();
  }

  play() {
    this.playAt(Date.now());
  }

  getCurrentReader() {
    return this.#opusReader;
  }

  #setupPlaybackTimer() {
    this.#playbackTimer = setInterval(() => {
      if (this.#opusReader != null) {
        console.log(this.#opusReader.getRemainingTimeSeconds());
        if (this.#opusReader.getRemainingTimeSeconds() < 0) {
          this.#playlist.nextSet();
          this.events?.emit("finished");
          console.log("new set!");
          this.play();
        }
      }
    }, 1000);
  }
}
