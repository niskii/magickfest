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

    onOutput: (buffer: Uint8Array<ArrayBufferLike>) => void;
    onFileEnd: () => void;
    onReset: () => void;

    #fetchTimer: NodeJS.Timeout;

    constructor(socket: Socket, bufferHealthManager: BufferHealthManager) {
        this.socket = socket;
        this.bufferHealthManager = bufferHealthManager;
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
        }, 1000);
    }

    stop() {
        clearTimeout(this.#fetchTimer);
    }

    reset() {
        clearTimeout(this.#fetchTimer);
        this.isFetching = false;
        this.lastChunkPage = 0;
        this.bufferHealthManager.reset();
        this.onReset();
    }

    validateChunk(chunk: MediaPacket) {
        if (chunk == null) return false;
        if (this.lastChunkPage == chunk.PacketEnd) return false;
        this.lastChunkPage = chunk.PacketEnd;
        return true;
    }

    logDelay(serverTime: number) {
        logger.info(
            "Delay of:",
            (
                serverTime - this.bufferHealthManager.getCurrentPlayPosition()
            ).toFixed(2),
            this.bufferHealthManager.getDownloadedAudioDuration().toFixed(2),
        );
    }
}
