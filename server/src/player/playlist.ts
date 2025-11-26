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
  CoverFile: string;
  AudioFiles: Array<AudioFile>;
}

export class Playlist {
  #sets: Array<Set>;
  #currentSet: number = 0;
  #id: string;

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
