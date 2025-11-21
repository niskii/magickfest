import EventEmitter from "node:events";
import { OpusReader } from "./opus-reader";
import { Playlist } from "./playlist";
import { Bitrate } from "@shared/types/audio-transfer";

export class Player {
  #readerCollection: Map<number, OpusReader>;
  #startTime: number;
  #forwarded: number;
  #playbackTimer: NodeJS.Timeout | null = null;
  #playlist;
  #waitnextset = false;
  events: EventEmitter | undefined;

  //testing
  #loop = false;

  constructor(playlist: Playlist, loop: boolean) {
    this.#playlist = playlist;
    this.#readerCollection = new Map();
    this.#startTime = 0;
    this.#forwarded = 0;

    this.#loop = loop;

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
      forwarded: this.#forwarded,
    };
  }

  setState(
    setIndex: number | null,
    startTime: number | null,
    forwarded: number | null,
  ) {
    if (setIndex !== null) {
      if (this.#playlist.getCurrentIndex() != setIndex) {
        this.events?.emit("newSet");
      }
      this.#playlist.setCurrentSet(setIndex);
    }
    if (startTime !== null) {
      this.#startTime = startTime;
    }
    if (forwarded !== null) {
      this.#forwarded = forwarded;
    }
  }

  nextSet() {
    this.#playlist.nextSet();
    this.events?.emit("newSet");
  }

  playAt(forwarded: number, startTime?: number) {
    console.log(this.#playlist.getCurrentIndex(), this.#playlist.getLength());
    if (this.#playlist.getCurrentIndex() >= this.#playlist.getLength()) {
      throw new Error("The playlist has ended");
    }

    this.#forwarded = forwarded;
    if (startTime !== undefined) this.#startTime = startTime;
    else this.#startTime = Date.now();

    this.#playbackTimer?.close();

    this.#readerCollection.clear();

    this.#playlist.forEachCurrentAudioFile((audioFile) => {
      const reader = new OpusReader(audioFile.File);
      reader.setClock(this.#startTime - forwarded);
      this.#readerCollection.set(audioFile.Bitrate, reader);
    });

    this.events?.emit("changedState");

    this.#setupPlaybackTimer();
  }

  playAtState() {
    this.playAt(this.#forwarded, this.#startTime);
  }

  playAtForwarded() {
    this.playAt(this.#forwarded, Date.now());
  }

  playAtStart() {
    this.playAt(0, Date.now());
  }

  getCurrentReader(bitrate: Bitrate) {
    return this.#readerCollection.get(bitrate);
  }

  #setupPlaybackTimer() {
    this.#playbackTimer = setInterval(() => {
      // using the high quality reader as a baseline for tracking time
      // because getting the duration of the file
      // would require a dedicated metadata reader.
      const currentReader = this.getCurrentReader(Bitrate.High);
      if (currentReader !== undefined) {
        console.log(
          (currentReader.getCurrentTimeMillis() / 1000).toFixed(1),
          "-",
          currentReader.getRemainingTimeSeconds().toFixed(1),
        );
        if (currentReader.getRemainingTimeSeconds() < 0 && !this.#waitnextset) {
          this.#waitnextset = true;
          setTimeout(() => {
            this.#waitnextset = false;
            if (!this.#loop) this.nextSet();
            this.playAtStart();
            console.log("new set!");
          }, globalThis.settings.playerNewSetTimeout);
        }
      }
    }, globalThis.settings.playerUpdateInterval);
  }
}
