import { readFileSync } from "fs";
import { ReadCode } from "@shared/types/read-codes";
import { AudioPacket } from "@shared/types/audio-transfer";
import {
  HeaderObject,
  OpusFileSplitter,
  Page,
} from "../thirdparty/opus-file-splitter/src/opus-file-splitter.mjs";

export class OpusReader {
  /**
   * Manages the opus pages.
   */
  #fileSplitter: OpusFileSplitter;

  /**
   * Metadata of the file.
   */
  #headerObject: HeaderObject;

  /**
   * Array of all the audio pages.
   */
  #pages: Array<Page>;

  /**
   * Total number of audio pages
   */
  #numberOfPages: number;

  /**
   * Calculated number of pages needed to satisfy a duration.
   */
  #minPagesForChunk: number;

  /**
   * Duration of the file.
   */
  #totalDurationSeconds: number;

  /**
   * Granule positions. Needed for binary searching.
   */
  #positions: Array<number>;

  constructor(file: string) {
    this.#fileSplitter = new OpusFileSplitter(readFileSync(file).buffer);
    this.#headerObject = this.#fileSplitter.headerObject;
    this.#pages = this.#fileSplitter.pages;
    this.#numberOfPages = this.#pages.length;
    this.#minPagesForChunk = this.calculateMinPages(
      globalThis.settings.chunkDuration,
      this.#headerObject.audioPageDuration,
    );
    this.#totalDurationSeconds = this.#fileSplitter.calculateDurationSeconds(
      BigInt(this.#headerObject.preskipGranule),
      this.#headerObject.PCMLength,
    );

    this.#positions = this.#pages.flatMap((p) => Number(p.position));
  }

  getTotalDuration() {
    return this.#totalDurationSeconds;
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
  makeChunkFromRange(start: number, end: number, time: number) {
    const chunks = this.#fileSplitter.sliceByPage(start, end);
    if (chunks !== null) {
      const packet: AudioPacket = {
        Buffer: chunks,
        PageStart: start,
        PageEnd: end,
        ChunkPlayPosition: this.#headerObject.audioPageDuration * start,
        TotalDuration: this.#totalDurationSeconds,
        ServerTime: time,
      };
      return packet;
    } else {
      return null;
    }
  }

  /**
   * Validates the requested play position and page number and creates an AudioPacket.
   *
   * @param time play position
   * @param pageStartOverride start of the range
   * @returns an AudioPacket and a read code
   */
  getChunkAtTime(time: number, pageStartOverride?: number) {
    const currentPage = this.searchPosition(time * 48000);
    const pageStart =
      pageStartOverride !== undefined ? pageStartOverride : currentPage;
    const pageEnd = this.getPageRangeEnd(pageStart);

    if (pageStart == pageEnd) return { data: null, status: ReadCode.EOF };

    if (pageStart > this.#numberOfPages || pageEnd > this.#numberOfPages)
      return { data: null, status: ReadCode.EOF };
    if (
      this.calculateRangeDuration(currentPage, pageStart) >=
      globalThis.settings.maxSecondsLoadAhead
    )
      return { data: null, status: ReadCode.INVALID };

    return {
      data: this.makeChunkFromRange(pageStart, pageEnd, time),
      status: ReadCode.CONTINUATION,
    };
  }
}
