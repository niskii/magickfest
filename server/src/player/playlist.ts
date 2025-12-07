import { createHash } from "crypto";
import { Bitrate } from "@shared/types/audio-transfer";
import { readFileSync } from "fs";
import path from "path";

interface AudioFile {
  Bitrate: Bitrate;
  File: string;
}

interface Set {
  Title: string;
  Author: string;
  CoverFile?: string;
  AudioFiles: Array<AudioFile>;
}

export class Playlist {
  #sets: Array<Set>;
  #currentSet: number = 0;
  #id: string;

  /**
   * Creates a new playlist given the json file provided with the file path.
   *
   * @remarks
   * The playlist hash is calculated given the contents of the json file.
   *
   * @param playlist file path
   */
  constructor(playlist: string) {
    const location = path.dirname(playlist) + "/";

    const setfiles: Array<string> = JSON.parse(
      readFileSync(playlist).toString(),
    )["Sets"];

    this.#sets = new Array();
    setfiles.forEach((file) => {
      const set: Set = JSON.parse(
        readFileSync(path.join(location, file)).toString(),
      );

      // Handle the relative paths.
      set.CoverFile = location + set.CoverFile;
      set.AudioFiles.map((af) => {
        af.File = path.join(location, af.File);
      });
      this.#sets.push(set);
    });

    this.#id = createHash("MD5").update(playlist).digest("hex");

    if (this.#sets === undefined)
      throw Error("Could not parse the JSON string");

    if (this.#sets.length === 0) throw Error("The playlist is empty");
  }

  /**
   * Returns the current set object.
   *
   * @returns set object
   */
  getCurrentSet() {
    return this.#sets[this.#currentSet];
  }

  /**
   * Returns the index of the set.
   *
   * @returns set index
   */
  getCurrentIndex() {
    return this.#currentSet;
  }

  /**
   * Set the index of the playlist of the set to play
   *
   * @param setIndex index of a valid set
   */
  setCurrentSet(setIndex: number) {
    if (setIndex >= 0 && setIndex < this.#sets.length)
      this.#currentSet = setIndex;
    else {
      throw new Error("The index is out of bounds");
    }
  }

  /**
   * Returns the total number of sets.
   *
   * @returns number of sets
   */
  getLength() {
    return this.#sets.length;
  }

  /**
   * Helper function for iterating the files of the current set.
   *
   * @param callbackfn callback function
   */
  forEachCurrentAudioFile(
    callbackfn: (value: AudioFile, index: number, array: AudioFile[]) => void,
  ) {
    this.getCurrentSet().AudioFiles.forEach(callbackfn);
  }

  /**
   * Returns the hash of the playlist
   *
   * @returns a hash string
   */
  getHash() {
    return this.#id;
  }

  /**
   * Changes the state of the playlist to the next set.
   *
   * @returns returns the next set index.
   */
  nextSet() {
    this.setCurrentSet(this.#currentSet + 1);
  }
}
