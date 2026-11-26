import { type AudioPacket, Bitrate } from "shared/types/audio-transfer";
import { ReadCode } from "shared/types/read-codes";
import { Socket } from "socket.io-client";
import logger from "../../../logger";
import { BufferHealthManager } from "../buffer-health-manager";
import { MediaSocket } from "../media-socket";

export class AudioStreamSocket extends MediaSocket {
    #bitrate: Bitrate;

    constructor(
        socket: Socket,
        timeKeeper: BufferHealthManager,
        bitrate: Bitrate,
        output: (buffer: Uint8Array<ArrayBufferLike>) => void,
    ) {
        super(socket, timeKeeper, output);
        this.#bitrate = bitrate;

        this.setupListeners();
    }

    setupListeners() {
        this.socket.removeListener("nextAudioChunk");
        this.socket.removeListener("syncedAudio");

        this.socket.on("syncedAudio", async (audioPacket: AudioPacket) => {
            logger.info("syncing!", this.lastChunkPage);
            this.isFetching = false;
            if (!audioPacket) return;

            this.initializeBufferHealth(audioPacket);
            this.handleChunk(audioPacket);
        });

        this.socket.on("nextAudioChunk", (audioPacket: AudioPacket) => {
            this.isFetching = false;
            if (!audioPacket) return;

            this.logDelay(audioPacket.ServerTime);
            this.updateBufferHealth(audioPacket);
            this.handleChunk(audioPacket);
        });
    }

    setBitrate(bitrate: Bitrate) {
        this.#bitrate = bitrate;
    }

    handleChunk(audioPacket: AudioPacket) {
        const isValid = this.validateChunk(audioPacket);
        if (!isValid) return;
        this.lastChunkPage = audioPacket.PacketEnd;
        this.onOutput(audioPacket.Buffer);
    }

    fetchCurrent() {
        this.isFetching = true;
        this.socket.emit(
            "fetchSyncedAudioChunk",
            { type: "audio", bitrate: this.#bitrate },
            (response: { status: ReadCode }) => {
                logger.info("Status code:", response.status);
            },
        );
    }

    fetchNext() {
        if (this.isFetching) return;
        this.isFetching = true;

        this.socket.emit(
            "fetchNextAudioChunk",
            {
                type: "audio",
                bitrate: this.#bitrate,
                pageStart: this.lastChunkPage,
            },
            (response: { status: ReadCode }) => {
                if (response.status == ReadCode.EOF) {
                    this.stop();
                    this.callOnFileEnd();
                    return;
                }
                if (response.status == ReadCode.INVALID)
                    logger.info("Going too far!");
            },
        );
    }
}
