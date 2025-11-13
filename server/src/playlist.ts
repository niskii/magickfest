import { createHash } from "crypto";

interface AudioFile {
  Bitrate: number;
  File: string;
}

interface Set {
  Title: string;
  Author: string;
  AudioFiles: Array<AudioFile>;
  CoverFile: string;
}

export class Playlist {
  #sets: Array<Set>;
  #currentSet;
  #id: string;

  constructor(playlist: string) {
    this.#sets = JSON.parse(playlist)["Sets"];
    this.#id = createHash("MD5").update(playlist).digest("hex");

    console.log("sets", this.#sets);

    if (this.#sets === undefined)
      throw Error("Could not parse the JSON string");

    if (this.#sets.length === 0) throw Error("The playlist is empty");

    this.#currentSet = 0;
  }

  getCurrentSet() {
    return this.#sets[this.#currentSet];
  }

  getCurrentIndex() {
    return this.#currentSet;
  }

  setCurrentSet(setIndex: number) {
    if (setIndex >= 0 && setIndex < this.#sets.length)
      this.#currentSet = setIndex;
    else {
      throw new Error("The index is out of bounds");
    }
  }

  getLength() {
    return this.#sets.length;
  }

  forEachCurrentAudioFile(
    callbackfn: (value: AudioFile, index: number, array: AudioFile[]) => void,
  ) {
    this.getCurrentSet().AudioFiles.forEach(callbackfn);
  }

  getHash() {
    return this.#id;
  }

  nextSet() {
    return this.#currentSet++;
  }
}
