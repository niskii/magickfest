import { AudioPacket } from "@shared/types/audio-transfer";
import { ReadCode } from "@shared/types/read-codes";
import { readFileSync } from "fs";
import { OpusFileSplitter } from "./synced-opus-splitter";
import {
    HeaderObject,
    Page,
    calculateDuration,
} from "src/player/formats/opus/metadata";
import { OpusSplitter } from "src/player/formats/opus/opus-splitter";
import { MediaReader } from "src/player/media-reader";

export class OpusReader implements MediaReader {
    /**
     * Manages the opus pages.
     */
    #fileSplitter: OpusSplitter;

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
        this.#headerObject = this.#fileSplitter.header;
        this.#pages = this.#fileSplitter.pages;
        this.#numberOfPages = this.#pages.length;
        this.#minPagesForChunk = this.calculateMinPages(
            globalThis.settings.application.chunkDuration,
            this.#headerObject.audioPageDuration,
        );
        this.#totalDurationSeconds = calculateDuration(
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
        pageStart = Math.floor(pageStart);
        pageEnd = Math.floor(pageEnd);
        if (
            pageStart < 0 ||
            pageEnd < 0 ||
            pageStart >= this.#numberOfPages ||
            pageEnd >= this.#numberOfPages
        )
            return 0;

        return calculateDuration(
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
     * @param position the sample number to target for the search
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
        return this.addPages(pageStart, this.#minPagesForChunk);
    }

    /**
     *
     * @param a positive page number 1
     * @param b positive page number 2
     * @returns page number within the limit of all pages.
     */
    addPages(a: number, b: number) {
        return Math.min(a + b, this.#numberOfPages);
    }

    /**
     * Returns an object containing a slice of audio with metadata.
     *
     * @param start page number to start the slice
     * @param end page number to end the slice
     * @returns MediaPacket containing audio buffer slice
     */
    createMediaPacketFromRange(start: number, end: number, time: number) {
        start = Math.floor(start);
        end = Math.floor(end);
        const chunks = this.#fileSplitter.sliceByPage(start, end);
        if (chunks !== null) {
            const packet: AudioPacket = {
                Buffer: chunks,
                PacketStart: start,
                PacketEnd: end,
                Timestamp: this.#headerObject.audioPageDuration * start,
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
     * @param timestamp start position
     * @param numberOfPages number of pages for the chunk
     * @param pageStartOverride start of the range
     * @returns a MediaPacket and a read code
     */
    async getChunkAtTime(timestamp: number, numberOfPages: number) {
        // opus sample rate is 48000 and we multiply that by seconds
        // to get a duration or the position in the sound.
        const currentPage = this.searchPosition(timestamp * 48000);
        const pageEnd = this.addPages(currentPage, numberOfPages);

        if (
            currentPage > this.#numberOfPages ||
            pageEnd > this.#numberOfPages ||
            currentPage == pageEnd
        )
            return { data: null, status: ReadCode.EOF };

        return {
            data: this.createMediaPacketFromRange(
                currentPage,
                pageEnd,
                timestamp,
            ),
            status: ReadCode.CONTINUATION,
        };
    }

    async getNextChunk(
        pageNumber: number,
        numberOfPages: number,
        timestamp: number,
    ) {
        const pageEnd = this.addPages(pageNumber, numberOfPages);
        if (pageNumber < 0 || pageNumber > this.#numberOfPages) {
            return { data: null, status: ReadCode.INVALID };
        }

        if (pageEnd > this.#numberOfPages || pageNumber == pageEnd)
            return { data: null, status: ReadCode.EOF };

        const currentPage = this.searchPosition(timestamp * 48000);

        if (
            this.calculateRangeDuration(currentPage, pageNumber) >=
            globalThis.settings.application.maxSecondsLoadAhead
        )
            return { data: null, status: ReadCode.INVALID };

        return {
            data: this.createMediaPacketFromRange(
                pageNumber,
                pageEnd,
                timestamp,
            ),
            status: ReadCode.CONTINUATION,
        };
    }
}
