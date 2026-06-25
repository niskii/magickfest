import EventEmitter from "node:events";
import { OpusReader } from "./opus-reader";
import { Playlist } from "./playlist";
import { Bitrate } from "@shared/types/audio-transfer";
import { PlaybackState, PlayerState } from "@shared/types/player-state";

export class Player {
    /**
     * Collection of opus readers loaded with different bitrate opus files.
     */
    #readerCollection: Map<Bitrate, OpusReader>;

    /**
     * Timestamp for when the player started.
     */
    #startTime: number;

    /**
     * Time in milliseconds the sound is forwarded.
     */
    #forwarded: number;

    /**
     * Timer for internal progression checking.
     */
    #playbackTimer: NodeJS.Timeout | null = null;

    /**
     * The playlist to play.
     */
    #playlist: Playlist;

    /**
     * Helper variable for newSet event
     */
    #latestSet = -1;

    /**
     * Boolean to lock the timer payload.
     */
    #waitNextSet = false;

    /**
     * Events for state changes.
     */
    events: EventEmitter | undefined;

    /**
     * state of the player
     */
    #state: PlaybackState;

    /**
     * The state of the player at the point of pausing.
     */
    #pointOfPause:number | null = null;

    //testing
    #loop = false;

    /**
     * Instantiate a new player with a playlist to play.
     *
     * @param playlist playlist to play
     * @param loop do loop the set
     */
    constructor(playlist: Playlist, loop: boolean) {
        this.#playlist = playlist;
        this.#startTime = 0;
        this.#forwarded = 0;
        this.#readerCollection = new Map();
        this.#state = PlaybackState.Stopped;
        this.loadCurrentSet();

        this.#loop = loop;

        this.events = new EventEmitter();
        if (this.events === undefined) {
            throw new Error("Could not create EventEmitter!");
        }
    }

    /**
     * Returns the playlist of the player.
     *
     * @returns playlist of the player
     */
    getPlaylist() {
        return this.#playlist;
    }

    /**
     * Returns the current state of the player.
     *
     * @returns an object containing the state
     */
    getState(): PlayerState {
        return {
            id: this.#playlist.getHash(),
            setIndex: this.#playlist.getCurrentIndex(),
            startTime: this.#startTime,
            forwarded: this.#forwarded,
            state: this.#state,
        };
    }

    
    /**
     * Returns the remaining time of the file given the position.
     *
     * @returns reamining time in seconds
     */
    getRemainingTimeSeconds() {
        const currentReader = this.getCurrentReader(Bitrate.High);
        if (currentReader === undefined) return 0;
        return (
            currentReader.getTotalDuration() - this.getCurrentPositionSeconds()
        );
    }

    /**
     * Returns the current play position in milliseconds.
     *
     * @returns play position in milliseconds
     */
    getCurrentPositionMilliseconds() {
        if (this.#state == PlaybackState.Paused && this.#pointOfPause) {
            return this.#forwarded + (this.#pointOfPause - this.#startTime)
        } else
            return Date.now() - this.#startTime + this.#forwarded;
    }

    /**
     * Returns the current play position in seconds.
     *
     * @returns play position in seconds
     */
    getCurrentPositionSeconds() {
        return this.getCurrentPositionMilliseconds() / 1000;
    }

    async loadCurrentSet() {
        this.#readerCollection.clear();
        this.#playlist.forEachCurrentAudioFile((audioFile) => {
            const reader = new OpusReader(audioFile.File);
            this.#readerCollection.set(audioFile.Bitrate, reader);
        });
    }

    /**
     * Returns an opus reader of the given bitrate.
     *
     * @param bitrate the desired bitrate
     * @returns an opus reader
     */
    getCurrentReader(bitrate: Bitrate) {
        return this.#readerCollection.get(bitrate);
    }

    /**
     * Returns the current chunk in the given bitrate of the opus file being played.
     *
     * @param bitrate
     * @returns an AudioPacket and a read code
     */
    getCurrentChunk(bitrate: Bitrate) {
        const reader = this.getCurrentReader(bitrate);
        if (reader)
            return reader.getChunkAtTime(this.getCurrentPositionSeconds());
    }

    /**
     * Returns the chunk starting at the page number in the given bitrate of the opus file being played.
     *
     * @param bitrate
     * @returns an AudioPacket and a read code
     */
    getNextChunk(pageStart: number, bitrate: Bitrate) {
        const reader = this.getCurrentReader(bitrate);
        if (reader)
            return reader.getChunkAtTime(
                this.getCurrentPositionSeconds(),
                pageStart,
            );
    }

    /**
     * Sets the state of the player.
     *
     * @param setIndex an index of a set
     * @param startTime the starting point
     * @param forwarded the time the set is forwarded
     */
    setState(
        setIndex: number | null,
        startTime: number | null,
        forwarded: number | null,
    ) {
        if (setIndex !== null && this.#playlist.getCurrentIndex() != setIndex) {
            this.#playlist.setCurrentSet(setIndex);
            this.loadCurrentSet();
            this.events?.emit("newSet");
        }
        if (startTime !== null) {
            this.#startTime = startTime;
        }
        if (forwarded !== null) {
            this.#forwarded = forwarded;
        }
    }

    /**
     * Changes the state of the player to the next set
     */
    nextSet() {
        try {
            this.#playlist.nextSet();
        } catch (error) {
            this.events?.emit("changedState");
            this.#state = PlaybackState.Stopped;
            this.#playlist.setCurrentSet(0)
            this.#playbackTimer?.close()
        }
        this.loadCurrentSet();
    }

    /**
     * Play the current set.
     *
     * @param forwarded milliseconds the set is forwarded
     * @param startTime unix time the set started
     */
    playAt(forwarded: number, startTime?: number) {
        const currentSet = this.#playlist.getCurrentIndex();
        if (currentSet >= this.#playlist.getLength()) {
            this.#state = PlaybackState.Stopped;
            this.#playlist.setCurrentSet(0)
        }

        this.#forwarded = forwarded;
        if (startTime !== undefined) this.#startTime = startTime;
        else this.#startTime = Date.now();

        this.#state = PlaybackState.Running;
        this.#playbackTimer?.close();

        if (this.#latestSet != currentSet) {
            this.#latestSet = currentSet;
            this.events?.emit("newSet");
        }

        this.events?.emit("changedState");
        this.#setupPlaybackTimer();
    }

    /**
     * Play the current set at the state of the player.
     */
    playAtState() {
        this.playAt(this.#forwarded, this.#startTime);
    }

    /**
     * Play the current set with the forwarded time. Otherwise starting point is now.
     */
    playAtForwarded() {
        this.playAt(this.#forwarded, Date.now());
    }

    /**
     * Play the current set from the beginning.
     */
    playAtStart() {
        this.playAt(0, Date.now());
    }

    pause() {
        if(this.#state == PlaybackState.Running) {
            this.#state = PlaybackState.Paused
            this.events?.emit("changedState");
            this.#pointOfPause = Date.now()
            this.#playbackTimer?.close();
        }
    }

    resume() {
        if(this.#state == PlaybackState.Paused && this.#pointOfPause !== null) {
            this.#forwarded = this.#forwarded + (this.#pointOfPause - this.#startTime)
            this.#startTime = Date.now()
            this.#state = PlaybackState.Running
            this.events?.emit("changedState");
            this.#setupPlaybackTimer();
        }
    }

    #setupPlaybackTimer() {
        this.#playbackTimer = setInterval(() => {
            if (this.getRemainingTimeSeconds() < 0 && !this.#waitNextSet) {
                this.#waitNextSet = true;
                setTimeout(() => {
                    this.#waitNextSet = false;
                    if (!this.#loop) this.nextSet();
                    if (this.#state == PlaybackState.Running)
                        this.playAtStart();
                }, globalThis.settings.playerNewSetTimeout);
            }
        }, globalThis.settings.playerUpdateInterval);
    }
}
