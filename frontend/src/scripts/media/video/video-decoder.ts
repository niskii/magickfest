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

// Message handler
self.onmessage = (event: MessageEvent<any>) => {
    switch (event.data.action) {
        case "init":
            setCanvas(event.data.canvas);
            break;
        case "externalClock":
            setExternalClockReference(event.data.timestamp);
            break;
        case "reset":
            reset();
            break;
        case "resume":
            resume();
            break;
        case "pause":
            pause();
            break;
        case "setDisabled":
            setDisabled(event.data.disabled);
            break;
        case "buffer":
            enqueueChunk(event.data.chunks);
            break;
    }
};

/**
 * Setter function
 * @param canvas OffscreenCanvas from a HTML canvas
 */
function setCanvas(canvas: OffscreenCanvas) {
    renderer = new WebGLRenderer(canvas);
}

/**
 * Calculates a delta based on an external clock's current time.
 * @param timestamp of external clock's current time
 */
function setExternalClockReference(timestamp: number) {
    const mediaTime = performance.now() - baseTime + firstFrameTime;
    const delta = timestamp - mediaTime;
    if (firstFrameTime) externalDelta = delta;
}

/**
 * Continues the decoder
 */
function resume(): void {
    if (!paused) return;
    paused = false;
    baseTime += performance.now() - pausedTimestamp;
    setTimeout(renderAnimationFrame, 0);
    setTimeout(handleChunk, 0);
}

/**
 * Pauses the decoder
 */
function pause(): void {
    if (paused) return;
    pausedTimestamp = performance.now();
    paused = true;
}

/**
 * Resets all state.
 */
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

/**
 * Stops rendering while the current time is still updated.
 * @param disabled
 */
function setDisabled(disabled: boolean) {
    isDisabled = disabled;

    if (!disabled) setTimeout(handleChunk, 0);
}

/**
 * Adds the compressed frames from a chunk to a queue.
 * Old frames get removed if the queue is full.
 */
function enqueueChunk(chunks: Uint8Array<ArrayBufferLike>): void {
    const encodedpackets = BSON.deserialize(chunks).chunks as EncodedPacket[];
    encodedpackets.forEach((chunk) => {
        if (pendingEncodedPackets.isFull()) {
            console.log("this happened!");
            pendingEncodedPackets.dequeue();
            isNeedingKeyFrame = true;
        }
        if (chunk) pendingEncodedPackets.enqueue(chunk);
    });

    if (chunkUnderflow) setTimeout(handleChunk, 0);
}

/**
 * Routine to dequeue the encoded frames and decode them.
 * Limits to 15 uncompressed frames to save memory.
 * If a frame has been dequeued without decoding it,
 * all delta frames must be skipped before the next keyframe.
 */
function handleChunk(): void {
    if (isDisabled) {
        console.log(pendingEncodedPackets.getSize());
        self.postMessage({
            action: "currentTime",
            currentTime: currentTime() * 1e3,
        });
        setTimeout(handleChunk, 1000);
        return;
    }

    chunkUnderflow = pendingEncodedPackets.getSize() == 0;
    if (chunkUnderflow || paused) return;

    if (videoDecoder.decodeQueueSize < 15 && pendingFrames.getSize() < 15) {
        const chunk = pendingEncodedPackets.dequeue();
        const timestamp = chunk.timestamp * 1e6;
        const duration = chunk.duration * 1e6;

        if (isNeedingKeyFrame) isNeedingKeyFrame = chunk.type != "key";

        if (!isNeedingKeyFrame) {
            const encodedVideoChunk = new EncodedVideoChunk({
                duration: duration,
                data: chunk.data.buffer,
                type: chunk.type,
                timestamp: timestamp,
            });

            videoDecoder.decode(encodedVideoChunk);
        }
    }
    setTimeout(handleChunk, 0);
}

function error(error: Error) {
    throw error;
}

/**
 * Adds a frame to the frame queue and starts the draw loop.
 * The timestamp of the first frame is saved to allow calculation of the current time.
 * @param frame VideoFrame from decoder
 */
function enqueueFrame(frame: VideoFrame): void {
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

/**
 * simple time since the decoder started.
 */
function currentTime(): number {
    return performance.now() - baseTime;
}

/**
 * Calculates the time to pass before the frame should be displayed according to the current time.
 * Negative numbers mean the frame can be skipped.
 * @param timestamp of a frame
 * @returns time in milliseconds
 */
function calculateTimeUntilNextFrame(timestamp: number): number {
    if (baseTime == 0) baseTime = performance.now();
    const result = timestamp / 1000 - mediaTime();
    return result;
}

/**
 * Dequeues a frame and renders it when the current time reaches the timestamp.
 */
async function renderAnimationFrame(): Promise<void> {
    frameUnderflow = pendingFrames.getSize() == 0;
    if (frameUnderflow || paused) return;

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
            currentTime: currentTime() * 1e3,
        });
        renderer.draw(frame);
        frame.close();
    }

    // Immediately schedule rendering of the next frame
    setTimeout(renderAnimationFrame, 0);
}

export default {};
