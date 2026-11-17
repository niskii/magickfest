import type { Socket } from "socket.io-client";
import type { BufferHealthManager } from "../buffer-health-manager";
import { ReadCode } from "shared/types/read-codes";
import logger from "../../logger";
import { Bitrate, type VideoPacket } from "shared/types/audio-transfer";
import { MediaSocket } from "../media-socket";

export class VideoStreamSocket extends MediaSocket {
    onOutput: (packets: Uint8Array<ArrayBufferLike>) => void;
    onFileEnd: () => void;
    isFetching = false;

    constructor(socket: Socket, bufferHealthManager: BufferHealthManager) {
        super(socket, bufferHealthManager);

        this.setupListeners();

        this.bufferHealthWatcher.onCurrent = this.getCurrent.bind(this);
        this.bufferHealthWatcher.onNext = this.getNext.bind(this);
    }

    setupListeners() {
        this.socket.removeListener("syncedVideo");
        this.socket.removeListener("nextVideoChunk");

        this.socket.on("syncedVideo", async (data: VideoPacket) => {
            this.isFetching = false;
            if (!data) return;

            logger.info("synced to video stream");

            this.bufferHealthManager.reset();
            this.initializeBufferHealth(data);
            this.handleChunk(data);
        });

        this.socket.on("nextVideoChunk", (data: VideoPacket) => {
            this.isFetching = false;
            if (!data) return;

            this.updateBufferHealth(data);

            this.handleChunk(data);
        });
    }

    getCurrent() {
        if (this.isFetching) return;
        this.isFetching = true;
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
        this.socket.emit(
            "fetchNextVideoChunk",
            {
                bitrate: Bitrate.High,
                pageStart: this.lastChunkPage,
            },
            (response: { status: ReadCode }) => {
                if (response.status == ReadCode.EOF) {
                    this.stop();
                    this.reset();
                    this.onFileEnd();
                    return;
                }
                if (response.status == ReadCode.INVALID)
                    logger.info("Going too far!");
            },
        );
    }

    handleChunk(chunk: VideoPacket) {
        const isValid = this.validateChunk(chunk);
        if (!isValid) {
            return;
        }
        if (chunk.EncodedPackets) this.onOutput(chunk.EncodedPackets);
    }

    reset() {
        this.lastChunkPage = 0;
    }
}
