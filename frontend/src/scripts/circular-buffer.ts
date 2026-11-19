export class CircularBuffer<T> {
    #head: number;
    #tail: number;
    #size: number;
    #array: Array<T> = null;
    #N: number;

    constructor(n: number) {
        this.#head = 0;
        this.#tail = 0;
        this.#size = 0;
        this.#array = new Array(n);
        this.#N = n;
    }

    clear() {
        this.#head = 0;
        this.#tail = 0;
        this.#array = new Array(this.#N);
    }

    isFull() {
        return this.#size == this.#N;
    }

    isEmpty() {
        return this.#size == 0;
    }

    getSize() {
        return this.#size;
    }

    enqueue(item: T) {
        if (this.isFull()) {
            throw new Error("Buffer is full");
        }
        this.#array[this.#tail] = item;
        this.#tail = (this.#tail + 1) % this.#N;
        ++this.#size;
    }

    dequeue(): T {
        if (this.isEmpty()) {
            throw new Error("Buffer is empty");
        }
        const item = this.#array[this.#head];
        this.#head = (this.#head + 1) % this.#N;
        --this.#size;
        return item;
    }
}
