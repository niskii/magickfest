import EventEmitter from "node:events";
import { OpusReader } from "./opus-reader";
import { Playlist } from "./playlist";

export enum Bitrate {
  High = 128,
  Medium = 96,
  Low = 64,
}

export class Player {
  #readerCollection: Map<number, OpusReader>;
  #startTime: number;
  #playbackTimer: NodeJS.Timeout | null = null;
  #playlist;
  events: EventEmitter | undefined;

  //testing
  #loop = false

  constructor(playlist: Playlist, loop: boolean) {
    this.#playlist = playlist;
    this.#readerCollection = new Map();
    this.#startTime = Date.now()

    this.#loop = loop

    this.events = new EventEmitter();
    if (this.events === undefined) {
      throw new Error("Could not create EventEmitter!");
    }
  }

  getPlaylist() {
    return this.#playlist;
  }

  getState() {
    return {
      id: this.#playlist.getHash(),
      setIndex: this.#playlist.getCurrentIndex(),
      startTime: this.#startTime,
    };
  }

  setState(setIndex: number, startTime: number) {
    this.#playlist.setCurrentSet(setIndex);
    this.#startTime = startTime
  }

  playAt(startTime: number) {
    this.#startTime = startTime;
    this.#playbackTimer?.close();

    this.#readerCollection.clear();
    this.#playlist.forEachCurrentAudioFile((audioFile) => {
      const reader = new OpusReader(audioFile.File);
      reader.setClock(startTime);
      this.#readerCollection.set(audioFile.Bitrate, reader);
    });

    this.#setupPlaybackTimer();
  }

  playAtState() {
    this.playAt(this.#startTime)
  }

  playAtStart() {
    this.playAt(Date.now());
  }

  getCurrentReader(bitrate: number) {
    if (!this.#readerCollection.has(bitrate)) return null;
    return this.#readerCollection.get(bitrate);
  }

  #setupPlaybackTimer() {
    this.#playbackTimer = setInterval(() => {
      // using the high quality reader as a baseline for tracking time
      // because a getting the duration of the file
      // would require a metadata reader.
      const currentReader = this.#readerCollection.get(Bitrate.High);
      if (currentReader !== undefined) {
        console.log(currentReader.getRemainingTimeSeconds());
        if (currentReader.getRemainingTimeSeconds() < 0) {
          if (!this.#loop)
            this.#playlist.nextSet();
          this.playAtStart();
          this.events?.emit("finished");
          console.log("new set!");
        }
      }
    }, 1000);
  }
}
