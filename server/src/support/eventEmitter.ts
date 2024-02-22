'use strict';

export class EventEmitter {
    private _listeners: Function[] = [];

    addListener(listener: Function) {
        this._listeners.push(listener);
        return {
            dispose: () => {
                let listen = this._listeners.indexOf(listener);
                if (listen > -1) {
                    this._listeners.splice(listen, 1);
                }
            },
        };
    }

    emit(eventData?: any) {
        this._listeners.forEach((listener) => {
            listener(eventData);
        });
    }
}

