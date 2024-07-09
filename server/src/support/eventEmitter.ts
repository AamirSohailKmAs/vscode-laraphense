'use strict';

export class EventEmitter<T> {
    private _listeners: Array<(eventData: T) => void> = [];
    private _eventsQueue: T[] = [];

    constructor(private _shouldQueueEvents: boolean = false) {}

    addListener(listener: (eventData: T) => void) {
        this._listeners.push(listener);

        if (this._shouldQueueEvents) {
            this._eventsQueue.forEach((eventData) => {
                this.emit(eventData);
            });
            this._eventsQueue = [];
        }

        return {
            dispose: () => {
                let listen = this._listeners.indexOf(listener);
                if (listen > -1) {
                    this._listeners.splice(listen, 1);
                }
            },
        };
    }

    emit(eventData: T) {
        if (this._listeners.length > 0) {
            this._listeners.forEach((listener) => {
                listener(eventData);
            });
        } else if (this._shouldQueueEvents) {
            this._eventsQueue.push(eventData);
        }
    }
}

