'use strict';

import { LRUCache } from 'lru-cache';

export class IdGenerator<UniqueID extends string> {
    constructor(private _wordStore: WordStore, private _stringSeparator: string, private idSeparator: string = '/') {}

    public toString(id: UniqueID): string {
        return id;
        // const ids = id.split(this.idSeparator);
        // const words: string[] = [];

        // for (let i = 0, l = ids.length; i < l; i++) {
        //     const word = this._wordStore.getValue(ids[i]);
        //     if (word) words.push(word);
        // }

        // return words.join(this._stringSeparator);
    }

    public toId(str: string): UniqueID {
        return str as UniqueID;
        // const words = str.split(this._stringSeparator);
        // const item: number[] = [];

        // for (let i = 0, l = words.length; i < l; i++) {
        //     item.push(this._wordStore.add(words[i]));
        // }

        // return item.join(this.idSeparator) as UniqueID;
    }
}

export class WordStore {
    private _words: string[];
    private _idMap: LRUCache<string, number>;

    constructor() {
        this._words = [];
        this._idMap = new LRUCache<string, number>({ max: 5000 });
    }

    public add(str: string): number {
        if (this._idMap.has(str)) return this._idMap.get(str)!;
        return this.addWord(str);
    }

    public getValue(id: string): string | undefined {
        const newId = parseInt(id);
        if (isNaN(newId)) return id;

        return this._words[newId];
    }

    public getId(str: string): number | undefined {
        let id = this._idMap.get(str);
        if (id) return id;

        for (let i = 0, l = this._words.length; i < l; i++) {
            if (this._words[i] === str) {
                this._idMap.set(str, i); // Update cache with fetched word
                return i;
            }
        }

        return undefined;
    }

    private addWord(word: string) {
        this._words.push(word);
        const id = this._words.length;
        this._idMap.set(word, id);
        return id;
    }
}

