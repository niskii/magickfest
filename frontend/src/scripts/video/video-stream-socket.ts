import type { Socket } from "socket.io-client";
import type { BufferHealthManager } from "../buffer-health-manager";
import { ReadCode } from "shared/types/read-codes";
import logger from "../../logger";
import { Bitrate, type VideoPacket } from "shared/types/audio-transfer";
import { MediaSocket } from "../media-socket";

export class VideoStreamSocket extends MediaSocket {
    onOutput: (packets: Uint8Array<ArrayBufferLike>) => void;
    isFetching = false;

    constructor(socket: Socket, bufferHealthManager: BufferHealthManager) {
        super(socket, bufferHealthManager);

        this.setupListeners();

        this.bufferHealthWatcher.onCurrent = this.getCurrent.bind(this);
        this.bufferHealthWatcher.onNext = this.getNext.bind(this);
    }

    setupListeners() {
        logger.warn("setting up sockets!");

        this.socket.on("syncedVideo", async (data: VideoPacket) => {
            this.isFetching = false;
            logger.info("syncing!", this.lastChunkPage);
            logger.info("got video");
            if (!data) return;

            this.initializeBufferHealth(data);

            this.handleChunk(data);
        });

        this.socket.on("nextVideoChunk", (data: VideoPacket) => {
            this.isFetching = false;
            logger.info("got more video");
            if (!data) return;

            this.updateBufferHealth(data);

            this.handleChunk(data);
        });
    }

    getCurrent() {
        if (this.isFetching) return;
        this.isFetching = true;
        logger.warn("getcurrent!");
        this.socket.emit(
            "fetchSyncedVideoChunk",
            { bitrate: Bitrate.High },
            (response: { status: ReadCode }) => {
                logger.info("Status code:", response.status);
            },
        );
    }

    getNext() {
        if (this.isFetching) return;
        this.isFetching = true;
        logger.warn("getting!", this.lastChunkPage);
        this.socket.emit(
            "fetchNextVideoChunk",
            {
                bitrate: Bitrate.High,
                pageStart: this.lastChunkPage,
            },
            (response: { status: ReadCode }) => {
                if (response.status == ReadCode.EOF) {
                    this.reset();
                    return;
                }
                if (response.status == ReadCode.INVALID)
                    logger.info("Going too far!");
            },
        );
    }

    handleChunk(chunk: VideoPacket) {
        this.validateChunk(chunk);
        this.onOutput(chunk.EncodedPackets);
    }

    reset() {
        this.lastChunkPage = 0;
    }
}
