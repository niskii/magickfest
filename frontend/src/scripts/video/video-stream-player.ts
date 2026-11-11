import logger from "../../logger";
import { VideoStreamSocket } from "./video-stream-socket";
import type { Socket } from "socket.io-client";
import {
    BufferHealthManager,
    VideoTimeContext,
} from "../buffer-health-manager";
import { VideoContext } from "./video-context";
import type { EncodedPacket } from "mediabunny";
import type { ShallowRef } from "vue";
import { BSON } from "bson";

export class VideoStreamPlayer {
    canvas: ShallowRef<HTMLCanvasElement>;
    canvasContext: CanvasRenderingContext2D;
    videoContext: VideoContext;
    videoDecoder: VideoDecoder;
    stream: VideoStreamSocket;
    bufferHealthManager: BufferHealthManager;

    constructor(socket: Socket, canvas: ShallowRef<HTMLCanvasElement>) {
        logger.info("creating video player");
        this.videoContext = new VideoContext();

        this.canvas = canvas;
        this.canvasContext = canvas.value.getContext("2d", {
            willReadFrequently: true,
        });

        this.bufferHealthManager = new BufferHealthManager();
        this.bufferHealthManager.setMediaContext(
            new VideoTimeContext(this.videoContext),
        );
        this.stream = new VideoStreamSocket(socket, this.bufferHealthManager);
        this.videoDecoder = new VideoDecoder({
            error: this.#error,
            output: (frame: VideoFrame) => {
                // this.videoContext.currentTimestamp = frame.timestamp / 1e6;
                this.canvasContext.drawImage(frame, 0, 0);
                frame.close();
            },
        });

        this.videoDecoder.configure({ codec: "av01.0.05M.08" });

        this.stream.onOutput = this.decode.bind(this);
    }

    start() {
        logger.info("starting video!");
        this.stream.start();
    }

    decode(chunks: Uint8Array<ArrayBufferLike>) {
        const encodedpackets = BSON.deserialize(chunks)
            .chunks as EncodedPacket[];
        // Process chunks in batches, not one at a time nor all at once
        encodedpackets.forEach((chunk) => {
            const encodedVideoChunk = new EncodedVideoChunk({
                duration: chunk.duration,
                data: chunk.data.buffer,
                type: chunk.type,
                timestamp: chunk.timestamp * 1e6,
            });

            this.videoDecoder.decode(encodedVideoChunk);
            this.videoContext.currentTimestamp = chunk.timestamp;
        });
    }

    #error(error: Error) {
        logger.error(error);
    }
}
