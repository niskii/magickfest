import type { Socket } from "socket.io-client";
import type { BufferHealthManager } from "../buffer-health-manager";
import { ReadCode } from "shared/types/read-codes";
import logger from "../../../logger";
import { Bitrate, type VideoPacket } from "shared/types/audio-transfer";
import { MediaSocket } from "../media-socket";

export class VideoStreamSocket extends MediaSocket {
    isFetching = false;

    constructor(
        socket: Socket,
        bufferHealthManager: BufferHealthManager,
        output: (buffer: Uint8Array<ArrayBufferLike>) => void,
    ) {
        super(socket, bufferHealthManager, output);

        this.setupListeners();
    }

    setupListeners() {
        this.socket.removeListener("syncedVideo");
        this.socket.removeListener("nextVideoChunk");

        this.socket.on("syncedVideo", async (videoPacket: VideoPacket) => {
            this.isFetching = false;
            if (!videoPacket) return;

            logger.info("synced to video stream");

            this.bufferHealthManager.reset();
            this.initializeBufferHealth(videoPacket);
            this.bufferHealthManager.addTotalTimeScheduled(
                videoPacket.PacketDuration,
            );
            this.handleChunk(videoPacket);
        });

        this.socket.on("nextVideoChunk", (videoPacket: VideoPacket) => {
            this.isFetching = false;
            if (!videoPacket) return;

            this.logDelay(videoPacket.ServerTime);

            this.updateBufferHealth(videoPacket);
            this.bufferHealthManager.addTotalTimeScheduled(
                videoPacket.PacketDuration,
            );

            this.handleChunk(videoPacket);
        });
    }

    override fetchCurrent() {
        this.isFetching = true;
        this.socket.emit(
            "fetchSyncedVideoChunk",
            { bitrate: Bitrate.High },
            (response: { status: ReadCode }) => {
                logger.info("Status code:", response.status);
            },
        );
    }

    override fetchNext() {
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
                    logger.info("end of file!");
                    this.stop();
                    this.callOnFileEnd();
                    return;
                }
                if (response.status == ReadCode.INVALID)
                    logger.info("Going too far!");
            },
        );
    }

    handleChunk(videoPacket: VideoPacket) {
        const isValid = this.validateChunk(videoPacket);
        if (!isValid) return;
        this.lastChunkPage = videoPacket.PacketEnd;
        if (videoPacket.EncodedPackets)
            this.onOutput(videoPacket.EncodedPackets);
    }
}
