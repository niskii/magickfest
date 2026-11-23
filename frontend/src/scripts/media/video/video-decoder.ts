import { BSON } from "bson";
import type { EncodedPacket } from "mediabunny";
import { WebGLRenderer } from "./webgl-renderer";
import { CircularBuffer } from "../../circular-buffer";

const videoDecoder = new VideoDecoder({
    error: error,
    output: (frame: VideoFrame) => {
        enqueueFrame(frame);
    },
});

videoDecoder.configure({
    codec: "av01.0.05M.08",
    hardwareAcceleration: "prefer-hardware",
    optimizeForLatency: true,
});

let renderer: WebGLRenderer = null;

let pendingEncodedPackets: CircularBuffer<EncodedPacket> = new CircularBuffer(
    700,
);
let pendingFrames: CircularBuffer<VideoFrame> = new CircularBuffer(30);

let isNeedingKeyFrame: boolean;
let frameUnderflow: boolean;
let chunkUnderflow: boolean;
let baseTime: number;
let firstFrameTime: number;

let externalDelta: number;

let paused: boolean;
let pausedTimestamp: number;

let isDisabled: boolean;

self.onmessage = (event: MessageEvent<any>) => {
    switch (event.data.action) {
        case "init":
            setCanvas(event.data.canvas);
            break;
        case "externalClock":
            setExternalClockReference(event.data.timestamp);
            break;
        case "flush":
            // TODO: find out if flush is needed
            // videoDecoder.flush();
            break;
        case "reset":
            reset();
            break;
        case "play":
            play();
            break;
        case "pause":
            pause();
            break;
        case "setDisabled": {
            setDisabled(event.data.disabled);
            break;
        }
        case "buffer":
            enqueueChunk(event.data.chunks);
            break;
    }
};

function setCanvas(canvas: OffscreenCanvas) {
    renderer = new WebGLRenderer(canvas);
}

function setExternalClockReference(timestamp: number) {
    const mediaTime = performance.now() - baseTime + firstFrameTime;
    const delta = timestamp - mediaTime;
    if (firstFrameTime) externalDelta = delta;
}

function play() {
    if (!paused) return;
    paused = false;
    baseTime += performance.now() - pausedTimestamp;
}

function pause() {
    if (paused) return;
    pausedTimestamp = performance.now();
    paused = true;
}

function reset() {
    videoDecoder.flush();

    pendingFrames.clear();
    pendingEncodedPackets.clear();
    isNeedingKeyFrame = true;
    frameUnderflow = true;
    chunkUnderflow = true;
    baseTime = 0;
    firstFrameTime = 0;
    externalDelta = 0;

    isDisabled = false;
    paused = false;
    pausedTimestamp = 0;
}

function setDisabled(disabled: boolean) {
    isDisabled = disabled;

    if (!disabled) setTimeout(handleChunk, 0);
}

function enqueueChunk(chunks: Uint8Array<ArrayBufferLike>) {
    const encodedpackets = BSON.deserialize(chunks).chunks as EncodedPacket[];
    encodedpackets.forEach((chunk) => {
        if (pendingEncodedPackets.isFull()) {
            pendingEncodedPackets.dequeue();
            isNeedingKeyFrame = true;
        }
        if (chunk) pendingEncodedPackets.enqueue(chunk);
    });

    if (chunkUnderflow) setTimeout(handleChunk, 0);
}

function handleChunk() {
    if (isDisabled) {
        self.postMessage({
            action: "currentTime",
            currentTime: mediaTime() * 1e3,
        });
        setTimeout(handleChunk, 1000);
        return;
    }

    chunkUnderflow = pendingEncodedPackets.getSize() == 0;
    if (chunkUnderflow) return;

    if (videoDecoder.decodeQueueSize < 15 && pendingFrames.getSize() < 15) {
        const chunk = pendingEncodedPackets.peek();
        const timestamp = chunk.timestamp * 1e6;
        const duration = chunk.duration * 1e6;

        if (isNeedingKeyFrame) isNeedingKeyFrame = chunk.type != "key";

        const timeUntilNextFrame = calculateTimeUntilNextFrame(timestamp);

        if (timeUntilNextFrame < 0) {
            pendingEncodedPackets.dequeue();
            isNeedingKeyFrame = true;
        }

        if (!isNeedingKeyFrame) {
            pendingEncodedPackets.dequeue();

            const encodedVideoChunk = new EncodedVideoChunk({
                duration: duration,
                data: chunk.data.buffer,
                type: chunk.type,
                timestamp: timestamp,
            });

            videoDecoder.decode(encodedVideoChunk);
        } else {
            self.postMessage({
                action: "currentTime",
                currentTime: timestamp,
            });
        }
    }
    setTimeout(handleChunk, 0);
}

function error(error: Error) {
    throw error;
}

function enqueueFrame(frame: VideoFrame) {
    if (!firstFrameTime) {
        firstFrameTime = frame.timestamp / 1000;
        externalDelta = 0;
    }

    pendingFrames.enqueue(frame);
    if (paused) return;
    if (frameUnderflow) setTimeout(renderAnimationFrame, 0);
}

/**
 * The time position of the video
 * @returns time in milliseconds
 */
function mediaTime() {
    return performance.now() - baseTime + firstFrameTime + externalDelta;
}

function calculateTimeUntilNextFrame(timestamp: number) {
    if (baseTime == 0) baseTime = performance.now();
    const result = timestamp / 1000 - mediaTime();
    return result;
}

async function renderAnimationFrame() {
    frameUnderflow = pendingFrames.getSize() == 0;
    if (frameUnderflow) return;

    const frame = pendingFrames.dequeue();

    // Based on the frame's timestamp calculate how much of real time waiting
    // is needed before showing the next frame.
    const timeUntilNextFrame = calculateTimeUntilNextFrame(frame.timestamp);
    if (timeUntilNextFrame > 0) {
        await new Promise((r) => {
            setTimeout(r, timeUntilNextFrame);
        });
        self.postMessage({
            action: "currentTime",
            currentTime: frame.timestamp,
        });
        renderer.draw(frame);
        frame.close();
    }

    // Immediately schedule rendering of the next frame
    setTimeout(renderAnimationFrame, 0);
}

export default {};
