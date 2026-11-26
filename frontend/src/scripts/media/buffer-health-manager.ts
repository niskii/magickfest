import config from "../../config/client.json";
import type { VideoContext } from "./video/video-context";

/**
 * Wrapper interface for media contexts.
 */
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

    /**
     *
     * @param duration time in seconds
     */
    addTotalTimeScheduled(duration: number) {
        this.#totalTimeScheduled += duration;
    }

    /**
     * Is the buffer length in time bellow the configured threshold.
     * @returns boolean value
     */
    isBelowThreshold() {
        return this.getDownloadedDuration() < config.FetchThreshold;
    }

    /**
     * Initializes the buffer health given the data of a synced chunk.
     * @param serverTime timestamp from server in seconds
     * @param timestamp timestamp of the syncronised chunk
     * @param totalDuration duration of the media
     */
    setInitialHealth(
        serverTime: number,
        timestamp: number,
        totalDuration: number,
    ) {
        this.#latestServerTime = serverTime;
        this.#startPosition = timestamp;
        this.#totalDuration = totalDuration;

        this.#delay = timestamp - serverTime - this.getCurrentTime();
    }

    /**
     * The current time of the media.
     * @returns timestamp in seconds
     */
    getCurrentPlayPosition() {
        return this.getCurrentTime() - this.#startedAt + this.#startPosition;
    }

    /**
     * The current time of the player context.
     * @returns timestamp in seconds
     */
    getCurrentTime() {
        if (!this.#mediaContext) return 0.0;
        return this.#mediaContext.getCurrentTime();
    }

    /**
     * The delay between the server and media.
     * @returns time in seconds
     */
    getDelay() {
        return this.#delay;
    }

    /**
     * The duration of the buffer.
     * @returns time in seconds
     */
    getDownloadedDuration() {
        return (
            this.#totalTimeScheduled - (this.getCurrentTime() - this.#startedAt)
        );
    }

    /**
     * How much time of the media is remaining given the current play position.
     * @returns time in seconds
     */
    getRemainingDuration() {
        return this.#totalDuration - this.getCurrentPlayPosition();
    }

    /**
     * Timestamp of when the media started.
     * @returns timestamp in seconds
     */
    getStartedAt() {
        return this.#startedAt;
    }

    /**
     * Total duration of the media.
     * @returns time in seconds
     */
    getTotalDuration() {
        return this.#totalDuration;
    }

    /**
     * Length of the buffer in seconds.
     * @returns time in seconds
     */
    getTotalTimeScheduled() {
        return this.#totalTimeScheduled;
    }

    /**
     * The latest timestamp from the server clock.
     * @returns time in seconds
     */
    getLatestServerTime() {
        return this.#latestServerTime;
    }

    /**
     * Setter for delay.
     * @param delay time in seconds
     */
    setDelay(delay: number) {
        this.#delay = delay;
    }

    /**
     * Setter for media context.
     * @param mediaContext
     */
    setMediaContext(mediaContext: MediaTimeContext) {
        this.#mediaContext = mediaContext;
    }

    /**
     * Setter for start timestamp.
     * @param startedAt time in seconds
     */
    setStartedAt(startedAt: number) {
        this.#startedAt = startedAt;
    }

    /**
     * Setter for the scheduled time.
     * @param totalTimeScheduled time in seconds
     */
    setTotalTimeScheduled(totalTimeScheduled: number) {
        this.#totalTimeScheduled = totalTimeScheduled;
    }

    /**
     * Setter for the latest timestamp from the server.
     * Frequent updating is required.
     * @param serverTime time in seconds
     */
    setLatestServerTime(serverTime: number) {
        this.#latestServerTime = serverTime;
    }
}
