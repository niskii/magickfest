import EventEmitter from "node:events";
import { OpusReader } from "./opus-reader";
import { Playlist } from "./playlist";
import { Bitrate } from "@shared/types/audio-transfer";

export class Player {
  /**
   * Collection of opus readers loaded with different bitrate opus files.
   */
  #readerCollection: Map<Bitrate, OpusReader>;

  /**
   * Timestamp for when the player started.
   */
  #startTime: number;

  /**
   * Time in milliseconds the sound is forwarded.
   */
  #forwarded: number;

  /**
   * Timer for internal progression checking.
   */
  #playbackTimer: NodeJS.Timeout | null = null;

  /**
   * The playlist to play.
   */
  #playlist;

  /**
   * Boolean to lock the timer payload.
   */
  #waitnextset = false;

  /**
   * Events for state changes.
   */
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
   * @param forwarded milliseconds the set is forwarded
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
   * Returns the remaining time of the file given the position.
   *
   * @returns reamining time in seconds
   */
  getRemainingTimeSeconds() {
    const currentReader = this.getCurrentReader(Bitrate.High);
    if (currentReader === undefined) return 0;
    return currentReader.getTotalDuration() - this.getCurrentPositionSeconds();
  }

  /**
   * Returns the current play position in milliseconds.
   *
   * @returns play position in milliseconds
   */
  getCurrentPositionMilliseconds() {
    return Date.now() - this.#startTime + this.#forwarded;
  }

  /**
   * Returns the current play position in seconds.
   *
   * @returns play position in seconds
   */
  getCurrentPositionSeconds() {
    return this.getCurrentPositionMilliseconds() / 1000;
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

  /**
   * Returns the current chunk in the given bitrate of the opus file being played.
   *
   * @param bitrate
   * @returns an AudioPacket and a read code
   */
  getCurrentChunk(bitrate: Bitrate) {
    const reader = this.getCurrentReader(bitrate);
    if (reader) return reader.getChunkAtTime(this.getCurrentPositionSeconds());
  }

  /**
   * Returns the chunk starting at the page number in the given bitrate of the opus file being played.
   *
   * @param bitrate
   * @returns an AudioPacket and a read code
   */
  getNextChunk(pageStart: number, bitrate: Bitrate) {
    const reader = this.getCurrentReader(bitrate);
    if (reader)
      return reader.getChunkAtTime(this.getCurrentPositionSeconds(), pageStart);
  }

  #setupPlaybackTimer() {
    this.#playbackTimer = setInterval(() => {
      if (this.getRemainingTimeSeconds() < 0 && !this.#waitnextset) {
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
