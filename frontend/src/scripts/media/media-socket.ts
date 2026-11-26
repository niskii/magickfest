import type { MediaPacket } from "shared/types/audio-transfer";
import { Socket } from "socket.io-client";
import config from "../../config/client.json";
import logger from "../../logger";
import { BufferHealthManager } from "./buffer-health-manager";

export abstract class MediaSocket {
    protected socket: Socket;
    protected bufferHealthManager: BufferHealthManager;
    protected lastChunkPage: number = 0;
    protected isFetching = false;

    protected abstract fetchCurrent(): void;
    protected abstract fetchNext(): void;

    protected onOutput: (buffer: Uint8Array<ArrayBufferLike>) => void;
    #onFileEnd?: () => void;
    #onReset?: () => void;

    #fetchTimer: NodeJS.Timeout;

    constructor(
        socket: Socket,
        bufferHealthManager: BufferHealthManager,
        output: (buffer: Uint8Array<ArrayBufferLike>) => void,
    ) {
        this.onOutput = output;
        this.socket = socket;
        this.bufferHealthManager = bufferHealthManager;
    }

    /**
     * Setter for the function to call when the media ends.
     * @param callback function to call
     */
    setOnFileEndCallback(callback: () => void) {
        this.#onFileEnd = callback;
    }

    /**
     * Setter for the function to call when the instance is reset.
     * @param callback function to call
     */
    setOnResetCallback(callback: () => void) {
        this.#onReset = callback;
    }

    callOnFileEnd() {
        if (this.#onFileEnd) this.#onFileEnd();
    }

    initializeBufferHealth(mediaPacket: MediaPacket) {
        this.bufferHealthManager.setInitialHealth(
            mediaPacket.ServerTime,
            mediaPacket.Timestamp,
            mediaPacket.TotalDuration,
        );
    }

    updateBufferHealth(mediaPacket: MediaPacket) {
        this.bufferHealthManager.setLatestServerTime(mediaPacket.ServerTime);
    }

    start() {
        this.fetchCurrent();
        clearTimeout(this.#fetchTimer);
        this.#fetchTimer = setInterval(async () => {
            if (
                this.bufferHealthManager.getCurrentPlayPosition() <
                this.bufferHealthManager.getLatestServerTime() -
                    config.MaxOutOfSync
            ) {
                this.reset();
                this.start();
            }
            if (this.bufferHealthManager.isBelowThreshold()) this.fetchNext();
        }, config.FetchInterval);
    }

    stop() {
        clearTimeout(this.#fetchTimer);
    }

    reset() {
        clearTimeout(this.#fetchTimer);
        this.isFetching = false;
        this.lastChunkPage = 0;
        this.bufferHealthManager.reset();
        if (this.#onReset) this.#onReset();
    }

    /**
     * Checks for null and page validity.
     * @param chunk to validate
     * @returns true if the chunk is valid
     */
    validateChunk(chunk: MediaPacket) {
        return chunk !== null && this.lastChunkPage !== chunk.PacketEnd;
    }

    logDelay(serverTime: number) {
        logger.info(
            "Delay of:",
            (
                serverTime - this.bufferHealthManager.getCurrentPlayPosition()
            ).toFixed(2),
            "Buffer Duration:",
            this.bufferHealthManager.getDownloadedDuration().toFixed(2),
            "in:",
            this.constructor.name,
        );
    }
}
