import { Socket } from "socket.io-client";
import { type Chunk } from "./chunk";
import { TimeKeeper } from "./time-keeper";

import config from "../../config/client.json";

export class SocketAudioStream {
    #socket: Socket;
    #timeKeeper: TimeKeeper;
    #fetchTimer: NodeJS.Timeout;
    #isFetching = false;
    #needsResync = false;
    #lastChunkPage = 0;
    #bitrate;

    onFetch;
    onFlush;

    constructor(socket: Socket, timeKeeper: TimeKeeper, bitrate: number) {
        this.#socket = socket;
        this.#timeKeeper = timeKeeper;
        this.#bitrate = bitrate;
    }

    setBitrate(bitrate: number) {
        this.#bitrate = bitrate;
    }

    async getMinimalNumberOfChunks() {
        if (this.#timeKeeper.getDownloadedAudioDuration() < config.FetchThreshold) {
            this.fetch();
        }
    }

    handleChunk(chunk: Chunk) {
        this.#isFetching = false;
        this.#lastChunkPage = chunk.pageEnd;
        this.onFetch(chunk.buffer);
    }

    async fetchCurrent() {
        this.#isFetching = true;
        this.#socket.emit(
            "fetchSyncedChunk",
            { bitrate: this.#bitrate },
            (response) => {
                console.log("Status code:", response.status);
            },
        );

        this.#socket.once("syncedChunk", async (chunk: Chunk) => {
            console.log("syncing!");
            this.#needsResync = false;
            this.#timeKeeper.setStartPosition(chunk.chunkPlayPosition);
            this.#timeKeeper.setTotalDuration(chunk.totalDuration);
            this.#timeKeeper.addDelay(
                chunk.chunkPlayPosition -
                chunk.serverTime / 1000 -
                this.#timeKeeper.getCurrentTime(),
            );
            this.handleChunk(chunk);
        });
    }

    fetch() {
        if (this.#isFetching) return;
        this.#isFetching = true;

        console.log("trying to fetch!");
        this.#socket.emit(
            "fetchChunkFromPage",
            { bitrate: this.#bitrate, lastPage: this.#lastChunkPage },
            (response) => {
                if (response.status == 1) {
                    this.onFlush();
                    this.reset();
                    return;
                }
            },
        );

        this.#socket.once("chunkFromPage", (chunk: Chunk) => {
            console.log(
                "Delay of:",
                chunk.serverTime / 1000 - this.#timeKeeper.getCurrentPlayPosition(),
            );
            if (
                this.#timeKeeper.getCurrentPlayPosition() <
                chunk.serverTime / 1000 - config.MaxOutOfSync
            ) {
                this.#needsResync = true;
            }
            this.handleChunk(chunk);
        });
    }

    async start() {
        this.fetchCurrent();
        this.#fetchTimer?.close();
        this.#fetchTimer = setInterval(async () => {
            if (this.#needsResync) {
                this.#needsResync = false;
                this.onFlush();
                this.fetchCurrent();
                return;
            }
            if (this.#isFetching) return;
            this.getMinimalNumberOfChunks();
        }, config.FetchInterval);
    }

    async reset() {
        this.#lastChunkPage = 0;
        this.#isFetching = false;
        this.#needsResync = false;
        clearTimeout(this.#fetchTimer);
    }
}
