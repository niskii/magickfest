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
});

let renderer: WebGLRenderer = null;

let pendingEncodedPackets: CircularBuffer<EncodedPacket> = new CircularBuffer(
    700,
);

let pendingFrames: CircularBuffer<VideoFrame> = new CircularBuffer(70);
let frameUnderflow = true;
let chunkUnderflow = true;
let baseTime = 0;
let firstFrameTime: number = 0;

let externalDelta = 0;

let paused = false;
let pausedTimestamp = 0;

self.onmessage = (event: MessageEvent<any>) => {
    switch (event.data.action) {
        case "init":
            setCanvas(event.data.canvas);
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
        case "externalClock":
            setExternalClockReference(event.data.timestamp);
            break;
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
    if (!frameUnderflow) externalDelta = delta;
}

function play() {
    paused = false;
    baseTime += performance.now() - pausedTimestamp;
}

function pause() {
    if (!paused) pausedTimestamp = performance.now();
    paused = true;
}

function reset() {
    pendingFrames.clear();
    pendingEncodedPackets.clear();
    frameUnderflow = true;
    chunkUnderflow = true;
    baseTime = 0;
    firstFrameTime = 0;
    videoDecoder.flush();
}

function enqueueChunk(chunks: Uint8Array<ArrayBufferLike>) {
    const encodedpackets = BSON.deserialize(chunks).chunks as EncodedPacket[];
    encodedpackets.forEach((chunk) => {
        if (chunk) pendingEncodedPackets.enqueue(chunk);
    });

    if (chunkUnderflow) setTimeout(handleChunk, 0);
}

function handleChunk() {
    chunkUnderflow = pendingEncodedPackets.getSize() == 0;
    if (chunkUnderflow) return;

    if (pendingFrames.getSize() < 30) {
        const chunk = pendingEncodedPackets.dequeue();
        const encodedVideoChunk = new EncodedVideoChunk({
            duration: chunk.duration * 1e6,
            data: chunk.data.buffer,
            type: chunk.type,
            timestamp: chunk.timestamp * 1e6,
        });

        videoDecoder.decode(encodedVideoChunk);
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

function calculateTimeUntilNextFrame(timestamp: number) {
    if (baseTime == 0) baseTime = performance.now();
    let mediaTime =
        performance.now() - baseTime + firstFrameTime + externalDelta;
    const result = timestamp / 1000 - mediaTime;
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
