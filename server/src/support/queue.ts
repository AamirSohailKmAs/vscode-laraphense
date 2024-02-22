import { QUEUE_CHUNK_SIZE } from './defaults';

export class Queue<T> {
    public index: number;
    public items: T[];
    private _total: number;

    constructor() {
        this.index = 0;
        this._total = 0;
        this.items = [];
    }

    get length() {
        return this.items.length - this.index;
    }

    get total() {
        return this._total;
    }

    /**
     * Appends new element(s) to the end of an queue, and returns the new length of the items in queue.
     */
    push(item: T) {
        ++this._total;
        this.items.push(item);

        return this._total;
    }

    /**
     * Removes the last element from an queue and returns it.
     * If the array is empty, undefined is returned and the array is not modified.
     * @returns
     */
    pop() {
        let item: T | undefined;
        if (this.index < this.items.length) {
            item = this.items[this.index++];
        }
        if (this.index > QUEUE_CHUNK_SIZE) {
            this.items = this.items.slice(this.index);
            this.index = 0;
        }
        return item;
    }

    /**
     * Clear the queue and reset to initial state
     */
    clear() {
        this.items = [];
        this.index = 0;
        this._total = 0;
    }
}

