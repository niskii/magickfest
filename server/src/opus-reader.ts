import { readFileSync } from "fs";
import { ReadCode } from "./read-codes";
import {
  HeaderObject,
  OpusFileSplitter,
  Page,
} from "./thirdparty/opus-file-splitter/src/opus-file-splitter.mjs";

export class OpusReader {
  #fileSplitter: OpusFileSplitter;
  #headerObject: HeaderObject;
  #startTime: number;
  #pages: Array<Page>;
  #numberOfPages: number;
  #minPagesForChunk: number;
  #preskipSeconds: number;
  #totalDurationSeconds: number;
  #positions: Array<number>;

  constructor(file: string) {
    this.#fileSplitter = new OpusFileSplitter(readFileSync(file).buffer);
    this.#headerObject = this.#fileSplitter.headerObject;
    this.#startTime = Date.now();
    this.#pages = this.#fileSplitter.pages;
    this.#numberOfPages = this.#pages.length;
    this.#minPagesForChunk = this.calculateMinPages(
      3,
      this.#headerObject.audioPageSize,
    );
    this.#preskipSeconds = this.#fileSplitter.preSkipSeconds;
    this.#totalDurationSeconds = this.#fileSplitter.calculateDurationSeconds(
      BigInt(this.#headerObject.preskipGranule),
      this.#headerObject.PCMLength,
    );

    this.#positions = this.#pages.flatMap((p) => Number(p.position));
  }

  startClock() {
    this.#startTime = Date.now();
  }

  getClock() {
    return this.#startTime;
  }

  setClock(time: number) {
    this.#startTime = time;
  }

  getCurrentTimeMillis() {
    return Date.now() - this.#startTime;
  }

  getRemainingTimeSeconds() {
    return this.#totalDurationSeconds - this.getCurrentTimeMillis() / 1000;
  }

  getPlayTimeSeconds() {
    return (Date.now() - this.#startTime) / 1000;
  }

  getCurrentPage() {
    return this.bytesToPage(this.getPlayTimeSeconds() * 48000);
  }

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

  calculateMinPages(minDuration: number, pageDuration: number) {
    return Math.max(Math.floor(minDuration / pageDuration), 1);
  }

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

  bytesToPage(position: number) {
    return this.#binarySearch(this.#positions, position);
  }

  getPageRangeEnd(pageStart: number) {
    return Math.min(pageStart + this.#minPagesForChunk, this.#numberOfPages);
  }

  makeChunkFromRange(start: number, end: number) {
    const chunks = this.#fileSplitter.sliceByPage(start, end);
    return {
      buffer: chunks,
      pageStart: start,
      pageEnd: end,
      chunkPlayPosition: this.#headerObject.audioPageSize * start,
      totalDuration: this.#totalDurationSeconds,
      serverTime: this.getCurrentTimeMillis(),
    };
  }

  getCurrentChunk() {
    const pageStart = this.getCurrentPage();
    const pageEnd = this.getPageRangeEnd(pageStart);
    if (pageStart == pageEnd) return { chunk: null, status: ReadCode.EOF };
    return {
      chunk: this.makeChunkFromRange(pageStart, pageEnd),
      status: ReadCode.CONTINUATION,
    };
  }

  getNextChunk(pageStart: number) {
    const currentPage = this.getCurrentPage();
    const pageEnd = this.getPageRangeEnd(pageStart);
    if (pageStart == pageEnd) return { chunk: null, status: ReadCode.EOF };

    console.log(
      "more data requested! %d, %d, %d",
      currentPage,
      pageStart,
      this.#numberOfPages - 1,
    );
    if (pageStart > this.#numberOfPages || pageEnd > this.#numberOfPages)
      return { chunk: null, status: ReadCode.EOF };
    if (this.calculateRangeDuration(currentPage, pageStart) > 30)
      return { chunk: null, status: ReadCode.INVALID };

    return {
      chunk: this.makeChunkFromRange(pageStart, pageEnd),
      status: ReadCode.CONTINUATION,
    };
  }
}
