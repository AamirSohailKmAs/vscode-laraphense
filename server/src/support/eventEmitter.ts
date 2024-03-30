'use strict';

export class EventEmitter<T> {
    private _listeners: Array<(eventData: T) => void> = [];
    private eventsQueue: T[] = [];

    constructor(private queueEvents: boolean = false) {}

    addListener(listener: (eventData: T) => void) {
        this._listeners.push(listener);

        if (this.queueEvents) {
            this.eventsQueue.forEach((eventData) => {
                this.emit(eventData);
            });
            this.eventsQueue = [];
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
        } else if (this.queueEvents) {
            this.eventsQueue.push(eventData);
        }
    }
}

