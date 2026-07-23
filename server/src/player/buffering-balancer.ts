import logger from "../logger";

export class BufferingBalancer {
    #size = 1;

    constructor() {}

    reset() {
        this.#size = 1;
    }

    getPageSize() {
        const currentSize = this.#size;
        this.#size = Math.min(this.#size * 2, 20);

        logger.info(currentSize);

        return currentSize;
    }
}
