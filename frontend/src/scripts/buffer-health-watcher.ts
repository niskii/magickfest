import logger from "../logger";
import config from "../config/client.json";
import { BufferHealthManager } from "./buffer-health-manager";

export class BufferHealthWatcher {
    #bufferHealthManager: BufferHealthManager;
    #fetchTimer: NodeJS.Timeout;

    onNext: () => void = null;
    onCurrent: () => void = null;
    onReset: () => void = null;

    constructor(bufferHealthManager: BufferHealthManager) {
        this.#bufferHealthManager = bufferHealthManager;
    }

    fetchCurrent() {
        this.onCurrent();
    }

    fetchNext() {
        this.onNext();
    }

    start() {
        this.fetchCurrent();
        clearTimeout(this.#fetchTimer);
        this.#fetchTimer = setInterval(async () => {
            if (
                this.#bufferHealthManager.getCurrentPlayPosition() <
                this.#bufferHealthManager.getLatestServerTime() -
                    config.MaxOutOfSync
            ) {
                this.reset();
            }
            if (this.#bufferHealthManager.isBelowThreshold()) this.fetchNext();
        }, 1000);
    }

    stop() {
        clearTimeout(this.#fetchTimer);
    }

    /**
     * Reset the state of the instance.
     */
    reset() {
        clearTimeout(this.#fetchTimer);
        if (typeof this.onReset == "function") this.onReset();
    }
}
