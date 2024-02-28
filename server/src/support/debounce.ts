'use strict';

export class Debounce<T, K> {
    private _eventParams: T[] = [];
    private _timer: undefined | NodeJS.Timeout;
    constructor(private _handler: (eventParams: T[]) => K, public waitInMilliseconds: number) {
        this._eventParams = [];
    }
    handle(eventParam?: T) {
        this.clear();
        if (eventParam !== undefined) {
            this._eventParams.push(eventParam);
        }
        this._timer = setTimeout(() => {
            this._handler(this._eventParams);
            this.clear();
        }, this.waitInMilliseconds);
    }
    clear() {
        clearTimeout(this._timer);
        this._timer = undefined;
        this._eventParams = [];
    }
    flush(defaultValue: T): T | K {
        if (!this._timer) {
            return defaultValue;
        }
        const params = this._eventParams;
        this.clear();
        return this._handler(params);
    }
}

