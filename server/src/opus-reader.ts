import { Status } from "./status";
import { OpusFileSplitter } from "./thirdparty/opus-file-splitter/src/opus-file-splitter.mjs";
import { readFileSync, createReadStream } from "fs";

export class OpusReader {
  fileSplitter;
  headerObject;
  startTime: number;
  pages;
  numberOfPages;
  minPagesForChunk;
  headerSize;
  preskip;
  totalDurationSeconds;
  positions;

  constructor(file: string) {
    this.fileSplitter = new OpusFileSplitter(readFileSync(file).buffer);
    this.headerObject = this.fileSplitter.headerObject;
    this.startTime = Date.now();
    this.pages = this.fileSplitter.pages;
    this.numberOfPages = this.pages.length;
    this.minPagesForChunk = this.calculateMinPages(
      3,
      this.headerObject.audioPageSize,
    );
    this.headerSize = this.fileSplitter.headByteLength;
    this.preskip = this.fileSplitter.calculateDurationSeconds(
      0n,
      BigInt(this.headerObject.preskip),
    );
    this.totalDurationSeconds = this.fileSplitter.calculateDurationSeconds(
      BigInt(this.headerObject.preskip),
      this.headerObject.PCMLength,
    );

    this.positions = this.pages.flatMap((p) => Number(p.position));
  }

  startClock() {
    this.startTime = Date.now()
  }

  getClock() {
    return this.startTime
  }

  setClock(time: number) {
    this.startTime = time;
  }


  getCurrentTimeMillis() {
    return Date.now() - this.startTime;
  }

  getRemainingTimeSeconds() {
    return (
      this.totalDurationSeconds -
      this.getCurrentTimeMillis() / 1000 -
      this.preskip
    );
  }

  getPlayTimeSeconds() {
    return (Date.now() - this.startTime) / 1000;
  }

  getCurrentPage() {
    return this.bytesToPage(this.getPlayTimeSeconds() * 48000);
  }

  calculateRangeDuration(pageStart: number, pageEnd: number) {
    if (
      pageStart < 0 ||
      pageEnd < 0 ||
      pageStart >= this.numberOfPages ||
      pageEnd >= this.numberOfPages
    )
      return 0;

    return this.fileSplitter.calculateDurationSeconds(
      this.pages[pageStart].position,
      this.pages[pageEnd].position,
    );
  }

  calculateMinPages(minDuration: number, pageDuration: number) {
    return Math.max(Math.floor(minDuration / pageDuration), 1);
  }

  binarySearch(arr: number[], target: number): number {
    let low = 0;
    let high = arr.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);

      if (arr[mid] === target) {
        return mid; // Target found
      } else if (arr[mid] < target) {
        low = mid + 1; // Discard the left half
      } else {
        high = mid - 1; // Discard the right half
      }
    }
    return low; // Target not found
  }

  bytesToPage(position: number) {
    return this.binarySearch(this.positions, position);
  }

  getPageRangeEnd(pageStart: number) {
    return Math.min(pageStart + this.minPagesForChunk, this.numberOfPages - 1);
  }

  makeChunkFromRange(start: number, end: number) {
    const duration = this.calculateRangeDuration(start, end);
    const chunks = this.fileSplitter.sliceByPage(start, end);
    console.log(start, end, duration);
    return {
      buffer: chunks,
      pageStart: start,
      pageEnd: end,
      duration: duration,
    };
  }

  validateRange() {}

  getCurrentChunk() {
    const pageStart = this.getCurrentPage();
    const pageEnd = this.getPageRangeEnd(pageStart);
    if (pageStart == pageEnd) return { chunk: null, status: Status.EOF };
    return {
      chunk: this.makeChunkFromRange(pageStart, pageEnd),
      status: Status.OK,
    };
  }

  getNextChunk(pageStart: number) {
    const currentPage = this.getCurrentPage();
    const pageEnd = this.getPageRangeEnd(pageStart);
    if (pageStart == pageEnd) return { chunk: null, status: Status.EOF };

    console.log(
      "more data requested! %d, %d, %d",
      currentPage,
      pageStart,
      this.numberOfPages,
    );
    if (pageStart >= this.numberOfPages || pageEnd >= this.numberOfPages)
      return { chunk: null, status: Status.EOF };
    if (this.calculateRangeDuration(currentPage, pageStart) > 30)
      return { chunk: null, status: Status.INVALID };

    return {
      chunk: this.makeChunkFromRange(pageStart, pageEnd),
      status: Status.OK,
    };
  }
}
