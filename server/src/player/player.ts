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

  /**
   * Instantiate a new player with a playlist to play.
   *
   * @param playlist playlist to play
   * @param loop do loop the set
   */
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

  /**
   * Returns the playlist of the player.
   *
   * @returns playlist of the player
   */
  getPlaylist() {
    return this.#playlist;
  }

  /**
   * Returns the current state of the player.
   *
   * @returns an object containing the state
   */
  getState() {
    return {
      id: this.#playlist.getHash(),
      setIndex: this.#playlist.getCurrentIndex(),
      startTime: this.#startTime,
      forwarded: this.#forwarded,
    };
  }

  /**
   * Sets the state of the player.
   *
   * @param setIndex an index of a set
   * @param startTime the starting point
   * @param forwarded the time the set is forwarded
   */
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

  /**
   * Changes the state of the player to the next set
   */
  nextSet() {
    this.#playlist.nextSet();
    this.events?.emit("newSet");
  }

  /**
   * Play the current set.
   *
   * @param forwarded unix time the set is forwarded
   * @param startTime unix time the set started
   */
  playAt(forwarded: number, startTime?: number) {
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

  /**
   * Play the current set at the state of the player.
   */
  playAtState() {
    this.playAt(this.#forwarded, this.#startTime);
  }

  /**
   * Play the current set with the forwarded time. Otherwise starting point is now.
   */
  playAtForwarded() {
    this.playAt(this.#forwarded, Date.now());
  }

  /**
   * Play the current set from the beginning.
   */
  playAtStart() {
    this.playAt(0, Date.now());
  }

  /**
   * Returns an opus reader of the given bitrate.
   *
   * @param bitrate the desired bitrate
   * @returns an opus reader
   */
  getCurrentReader(bitrate: Bitrate) {
    return this.#readerCollection.get(bitrate);
  }

  #setupPlaybackTimer() {
    this.#playbackTimer = setInterval(() => {
      // using the high quality reader as a baseline for tracking time
      // because getting the duration of the file
      // would require a dedicated metadata reader.
      const currentReader = this.getCurrentReader(Bitrate.High);
      if (currentReader === undefined) return;
      if (currentReader.getRemainingTimeSeconds() < 0 && !this.#waitnextset) {
        this.#waitnextset = true;
        setTimeout(() => {
          this.#waitnextset = false;
          if (!this.#loop) this.nextSet();
          this.playAtStart();
          console.log("new set!");
        }, globalThis.settings.playerNewSetTimeout);
      }
    }, globalThis.settings.playerUpdateInterval);
  }
}
