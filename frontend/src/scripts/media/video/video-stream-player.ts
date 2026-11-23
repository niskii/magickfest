import type { Socket } from "socket.io-client";
import {
    BufferHealthManager,
    VideoTimeContext,
} from "../buffer-health-manager";
import { VideoContext } from "./video-context";
import WorkerDecoder from "./video-decoder?worker";
import { VideoStreamSocket } from "./video-stream-socket";
import logger from "../../../logger";

export class VideoStreamPlayer {
    videoContext: VideoContext;
    stream: VideoStreamSocket;
    bufferHealthManager: BufferHealthManager;
    decoder: Worker;

    constructor(socket: Socket, canvas: HTMLCanvasElement) {
        this.videoContext = new VideoContext();

        this.bufferHealthManager = new BufferHealthManager();
        this.bufferHealthManager.setMediaContext(
            new VideoTimeContext(this.videoContext),
        );
        this.stream = new VideoStreamSocket(socket, this.bufferHealthManager);

        const offscreen = canvas.transferControlToOffscreen();

        this.decoder = new WorkerDecoder();
        this.decoder.postMessage({ action: "init", canvas: offscreen }, [
            offscreen,
        ]);
        this.decoder.addEventListener("message", (msg: MessageEvent<any>) => {
            if (!this.bufferHealthManager.getStartedAt())
                this.bufferHealthManager.setStartedAt(
                    msg.data.currentTime / 1_000_000,
                );
            this.videoContext.currentTimestamp =
                msg.data.currentTime / 1_000_000;
        });

        this.stream.onOutput = this.#decode.bind(this);
        this.stream.onFileEnd = this.#flush.bind(this);
        this.stream.onReset = () => {
            logger.info("resetting the video decoder!");
            this.decoder.postMessage({ action: "reset" });
            this.videoContext.currentTimestamp = 0;
        };
    }

    start() {
        this.stream.start();
    }

    reset() {
        this.stream.reset();
    }

    stop() {
        this.stream.stop();
    }

    #decode(chunks: Uint8Array<ArrayBufferLike>) {
        this.decoder.postMessage({ action: "buffer", chunks }, [chunks]);
    }

    #flush() {
        this.decoder.postMessage({ action: "flush" });
    }

    setRendererDisabled(disabled: boolean) {
        this.decoder.postMessage({ action: "setDisabled", disabled });
    }

    setExternalClockReference(timestamp: number) {
        this.decoder.postMessage({
            action: "externalClock",
            timestamp,
        });
    }
}
