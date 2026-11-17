import { BSON } from "bson";
import type { EncodedPacket } from "mediabunny";
import { WebGLRenderer } from "./webgl-renderer";

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

let pendingFrames: VideoFrame[] = [];
let underflow = true;
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
            videoDecoder.flush();
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
            handleChunks(event.data.chunks);
            break;
    }
};

function setCanvas(canvas: OffscreenCanvas) {
    renderer = new WebGLRenderer(canvas);
}

function setExternalClockReference(timestamp: number) {
    const mediaTime = performance.now() - baseTime + firstFrameTime;
    const delta = timestamp - mediaTime;
    if (!underflow) externalDelta = delta;
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
    pendingFrames = [];
    underflow = true;
    baseTime = 0;
    firstFrameTime = 0;
}

function handleChunks(chunks: Uint8Array<ArrayBufferLike>) {
    const encodedpackets = BSON.deserialize(chunks).chunks as EncodedPacket[];
    // Process chunks in batches, not one at a time nor all at once
    encodedpackets.forEach((chunk) => {
        if (!chunk) return;
        const encodedVideoChunk = new EncodedVideoChunk({
            duration: chunk.duration * 1e6,
            data: chunk.data.buffer,
            type: chunk.type,
            timestamp: chunk.timestamp * 1e6,
        });

        videoDecoder.decode(encodedVideoChunk);
    });
}

function error(error: Error) {
    throw error;
}

function enqueueFrame(frame: VideoFrame) {
    if (!firstFrameTime) {
        firstFrameTime = frame.timestamp / 1000;
        externalDelta = 0;
    }
    pendingFrames.push(frame);
    if (paused) return;
    if (underflow) setTimeout(renderAnimationFrame, 0);
}

function calculateTimeUntilNextFrame(timestamp: number) {
    if (baseTime == 0) baseTime = performance.now();
    let mediaTime =
        performance.now() - baseTime + firstFrameTime + externalDelta;
    const result = timestamp / 1000 - mediaTime;
    return result;
}

async function renderAnimationFrame() {
    underflow = pendingFrames.length == 0;
    if (underflow) return;

    const frame = pendingFrames.shift();

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
