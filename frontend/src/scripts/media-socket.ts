import { Socket } from "socket.io-client";
import { BufferHealthManager } from "./buffer-health-manager";
import { BufferHealthWatcher } from "./buffer-health-watcher";
import type { MediaPacket } from "shared/types/audio-transfer";
import logger from "../logger";

export class MediaSocket {
    protected socket: Socket;
    protected bufferHealthManager: BufferHealthManager;
    protected bufferHealthWatcher: BufferHealthWatcher;
    protected lastChunkPage: number;

    constructor(socket: Socket, bufferHealthManager: BufferHealthManager) {
        this.socket = socket;
        this.bufferHealthManager = bufferHealthManager;
        this.bufferHealthWatcher = new BufferHealthWatcher(bufferHealthManager);
        logger.info("making media socket!");
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
        this.bufferHealthWatcher.start();
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
