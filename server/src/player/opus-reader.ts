import { readFileSync } from "fs";
import { ReadCode } from "@shared/types/read-codes";
import { AudioPacket } from "@shared/types/audio-transfer";
import {
  HeaderObject,
  OpusFileSplitter,
  Page,
} from "../thirdparty/opus-file-splitter/src/opus-file-splitter.mjs";

export class OpusReader {
  #fileSplitter: OpusFileSplitter;
  #headerObject: HeaderObject;
  #startTime: number;
  #pages: Array<Page>;
  #numberOfPages: number;
  #minPagesForChunk: number;
  #totalDurationSeconds: number;
  #positions: Array<number>;

  constructor(file: string) {
    this.#fileSplitter = new OpusFileSplitter(readFileSync(file).buffer);
    this.#headerObject = this.#fileSplitter.headerObject;
    this.#startTime = Date.now();
    this.#pages = this.#fileSplitter.pages;
    this.#numberOfPages = this.#pages.length;
    this.#minPagesForChunk = this.calculateMinPages(
      globalThis.settings.chunkDuration,
      this.#headerObject.audioPageSize,
    );
    this.#totalDurationSeconds = this.#fileSplitter.calculateDurationSeconds(
      BigInt(this.#headerObject.preskipGranule),
      this.#headerObject.PCMLength,
    );

    this.#positions = this.#pages.flatMap((p) => Number(p.position));
  }

  /**
   * Resets the internal clock of the reader.
   */
  resetClock() {
    this.#startTime = Date.now();
  }

  /**
   * Get the internal starting point of the reader.
   *
   * @returns unix time point
   */
  getClock() {
    return this.#startTime;
  }

  /**
   * Set the internal clock of the reader.
   *
   * @param time unix time
   */
  setClock(time: number) {
    this.#startTime = time;
  }

  /**
   * Returns the current play position in milliseconds.
   *
   * @returns play position in milliseconds
   */
  getCurrentTimeMillis() {
    return Date.now() - this.#startTime;
  }

  /**
   * Returns the remaining time of the file given the position.
   *
   * @returns reamining time in seconds
   */
  getRemainingTimeSeconds() {
    return this.#totalDurationSeconds - this.getCurrentTimeMillis() / 1000;
  }

  /**
   * Returns the current play position in seconds.
   *
   * @returns play position in seconds
   */
  getPlayTimeSeconds() {
    return (Date.now() - this.#startTime) / 1000;
  }

  /**
   * Returns the page number of the current play position.
   *
   * @returns page number
   */
  getCurrentPage() {
    return this.searchPosition(this.getPlayTimeSeconds() * 48000);
  }

  /**
   * Returns the duration of a range of pages.
   *
   * @param pageStart start page number
   * @param pageEnd end page number
   * @returns number in seconds
   */
  calculateRangeDuration(pageStart: number, pageEnd: number) {
    if (
      pageStart < 0 ||
      pageEnd < 0 ||
      pageStart >= this.#numberOfPages ||
      pageEnd >= this.#numberOfPages
    )
      return 0;

    return this.#fileSplitter.calculateDurationSeconds(
      this.#pages[pageStart].position,
      this.#pages[pageEnd].position,
    );
  }

  /**
   * Determines how many pages are needed to satisfy the duration.
   *
   * @param minDuration minimal duration allowed
   * @param pageDuration duration of a single page
   * @returns number of pages need
   */
  calculateMinPages(minDuration: number, pageDuration: number) {
    return Math.max(Math.floor(minDuration / pageDuration), 1);
  }

  /**
   * Returns index of target element
   *
   * @param arr array to search
   * @param target target number
   * @returns index in array
   */
  #binarySearch(arr: number[], target: number): number {
    let low = 0;
    let high = arr.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);

      if (arr[mid] === target) {
        return mid;
      } else if (arr[mid] < target) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return low;
  }

  /**
   * Returns the nearest page to the position.
   *
   * @param position target position for the search
   * @returns the found page number
   */
  searchPosition(position: number) {
    return this.#binarySearch(this.#positions, position);
  }

  /**
   * Returns the page number with a predetermined distance to the parameter.
   *
   * @param pageStart number to start the range
   * @returns number of the page ending the range
   */
  getPageRangeEnd(pageStart: number) {
    return Math.min(pageStart + this.#minPagesForChunk, this.#numberOfPages);
  }

  /**
   * Returns an object containing a slice of audio with metadata.
   *
   * @param start page number to start the slice
   * @param end page number to end the slice
   * @returns AudioPacket containing audio buffer slice
   */
  makeChunkFromRange(start: number, end: number) {
    const chunks = this.#fileSplitter.sliceByPage(start, end);
    if (chunks !== null) {
      const packet: AudioPacket = {
        Buffer: chunks,
        PageStart: start,
        PageEnd: end,
        ChunkPlayPosition: this.#headerObject.audioPageSize * start,
        TotalDuration: this.#totalDurationSeconds,
        ServerTime: this.getCurrentTimeMillis(),
      };
      return packet;
    } else {
      return null;
    }
  }

  /**
   * Returns the AudioPacket at the current play position.
   *
   * @returns an AudioPacket
   */
  getCurrentChunk() {
    const pageStart = this.getCurrentPage();
    const pageEnd = this.getPageRangeEnd(pageStart);
    if (pageStart == pageEnd) return { data: null, status: ReadCode.EOF };
    return {
      data: this.makeChunkFromRange(pageStart, pageEnd),
      status: ReadCode.CONTINUATION,
    };
  }

  /**
   * Returns an AudioPacket of default duration.
   *
   * @param pageStart starting point for the range
   * @returns an AudioPacket
   */
  getNextChunk(pageStart: number) {
    const currentPage = this.getCurrentPage();
    const pageEnd = this.getPageRangeEnd(pageStart);
    if (pageStart == pageEnd) return { data: null, status: ReadCode.EOF };

    if (pageStart > this.#numberOfPages || pageEnd > this.#numberOfPages)
      return { data: null, status: ReadCode.EOF };
    if (
      this.calculateRangeDuration(currentPage, pageStart) >
      globalThis.settings.maxSecondsLoadAhead
    )
      return { data: null, status: ReadCode.INVALID };

    return {
      data: this.makeChunkFromRange(pageStart, pageEnd),
      status: ReadCode.CONTINUATION,
    };
  }
}
