import config from "../config/client.json";
import type { VideoContext } from "./video/video-context";

export interface MediaTimeContext {
    getCurrentTime: () => number;
}

export class AudioTimeContext implements MediaTimeContext {
    audioContext: AudioContext;

    constructor(audioContext: AudioContext) {
        this.audioContext = audioContext;
    }

    getCurrentTime() {
        return this.audioContext.currentTime;
    }
}

export class VideoTimeContext implements MediaTimeContext {
    videoContext: VideoContext;

    constructor(videoContext: VideoContext) {
        this.videoContext = videoContext;
    }

    getCurrentTime() {
        return this.videoContext.currentTimestamp;
    }
}

export class BufferHealthManager {
    #mediaContext: MediaTimeContext;
    #startedAt: number;
    #totalTimeScheduled: number;
    #totalDuration: number;
    #startPosition: number;
    #delay: number;
    #latestServerTime: number;

    constructor() {
        this.reset();
    }

    reset() {
        this.#startedAt = 0.0;
        this.#totalTimeScheduled = 0.0;
        this.#totalDuration = 0.0;
        this.#startPosition = 0.0;
        this.#delay = 0.0;
    }

    addTotalTimeScheduled(duration: number) {
        this.#totalTimeScheduled += duration;
    }

    addDelay(delay: number) {
        this.#delay = delay;
    }

    isBelowThreshold() {
        return this.getDownloadedAudioDuration() < config.FetchThreshold;
    }

    setInitialHealth(
        serverTime: number,
        timeStamp: number,
        totalDuration: number,
    ) {
        this.#latestServerTime = serverTime;
        this.#startPosition = timeStamp;
        this.#totalDuration = totalDuration;

        this.#delay = timeStamp - serverTime - this.getCurrentTime();
    }

    getCurrentPlayPosition() {
        if (!this.#mediaContext) return 0.0;

        return (
            this.#mediaContext.getCurrentTime() -
            this.#startedAt +
            this.#startPosition +
            this.#delay
        );
    }

    getCurrentTime() {
        return this.#mediaContext.getCurrentTime();
    }

    getDelay() {
        return this.#delay;
    }

    getDownloadedAudioDuration() {
        if (!this.#mediaContext) return 0.0;

        return (
            this.#totalTimeScheduled -
            (this.#mediaContext.getCurrentTime() - this.#startedAt)
        );
    }

    getRemainingAudio() {
        return this.#totalDuration - this.getCurrentPlayPosition();
    }

    getStartedAt() {
        return this.#startedAt;
    }

    getTotalDuration() {
        return this.#totalDuration;
    }

    getTotalTimeScheduled() {
        return this.#totalTimeScheduled;
    }

    getLatestServerTime() {
        return this.#latestServerTime;
    }

    setMediaContext(mediaContext: MediaTimeContext) {
        this.#mediaContext = mediaContext;
    }

    setStartedAt(startedAt: number) {
        this.#startedAt = startedAt;
    }

    setStartPosition(startPosition: number) {
        this.#startPosition = startPosition;
    }

    setTotalTimeScheduled(totalTimeScheduled: number) {
        this.#totalTimeScheduled = totalTimeScheduled;
    }

    setTotalDuration(totalDuration: number) {
        this.#totalDuration = totalDuration;
    }

    setLatestServerTime(serverTime: number) {
        this.#latestServerTime = serverTime;
    }
}
