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
    #videoContext: VideoContext;
    #stream: VideoStreamSocket;
    #bufferHealthManager: BufferHealthManager;
    #decoder: Worker;

    constructor(socket: Socket, canvas: OffscreenCanvas) {
        this.#videoContext = new VideoContext();

        this.#bufferHealthManager = new BufferHealthManager();
        this.#bufferHealthManager.setMediaContext(
            new VideoTimeContext(this.#videoContext),
        );
        this.#stream = new VideoStreamSocket(
            socket,
            this.#bufferHealthManager,
            this.#decode.bind(this),
        );

        this.#decoder = new WorkerDecoder();
        this.#decoder.postMessage({ action: "init", canvas: canvas }, [canvas]);
        this.#decoder.addEventListener("message", (msg: MessageEvent<any>) => {
            const currentTime = msg.data.currentTime / 1e6;
            if (!this.#bufferHealthManager.getStartedAt())
                this.#bufferHealthManager.setStartedAt(currentTime);
            this.#videoContext.currentTimestamp = currentTime;
        });

        this.#stream.setOnResetCallback(this.onReset.bind(this));
    }

    onReset() {
        logger.info("resetting the video decoder!");
        this.#decoder.postMessage({ action: "reset" });
        this.#videoContext.currentTimestamp = 0;
    }

    start() {
        this.#stream.start();
    }

    reset() {
        this.#stream.reset();
    }

    stop() {
        this.#stream.stop();
    }

    pause() {
        this.#decoder.postMessage({ action: "pause" });
    }

    resume() {
        this.#decoder.postMessage({ action: "resume" });
    }

    #decode(chunks: Uint8Array<ArrayBufferLike>) {
        this.#decoder.postMessage({ action: "buffer", chunks }, [chunks]);
    }

    setRendererDisabled(disabled: boolean) {
        this.#decoder.postMessage({ action: "setDisabled", disabled });
    }

    setExternalClockReference(timestamp: number) {
        this.#decoder.postMessage({
            action: "externalClock",
            timestamp,
        });
    }
}
