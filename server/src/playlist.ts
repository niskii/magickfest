import { createHash } from "crypto";

interface Set {
  Title: string;
  Author: string;
  File: string;
}

export class Playlist {
  #sets: Array<Set>;
  #currentSet;
  #id: string;

  constructor(playlist: string) {
    this.#sets = JSON.parse(playlist)["sets"];
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

  setCurrentSet(setIndex: number) {
    if (setIndex >= 0 && setIndex < this.#sets.length)
      this.#currentSet = setIndex;
  }

  getHash() {
    return this.#id;
  }

  nextSet() {
    return this.#currentSet++;
  }
}
