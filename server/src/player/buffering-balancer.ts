
export class BufferingBalancer {
    #size = 1;
    #latestGet = 0

    constructor() {}

    reset() {
        this.#size = 1;
        this.#latestGet = 0;
    }

    getPageSize() {
        const currentSize = this.#size;
        if (Date.now() - this.#latestGet < this.#size * 1000 + 2000) {
            this.#size = Math.min(this.#size * 2, 20);
        } else {
            this.#size = Math.floor(Math.max(this.#size / 2, 2));
        }


        this.#latestGet = Date.now()

        return currentSize;
    }
}
