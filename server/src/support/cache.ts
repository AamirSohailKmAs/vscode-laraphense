'use strict';

import { DocumentUri, TextDocument } from 'vscode-languageserver-textdocument';
import { DEFAULT_MAX_OPEN_FILES } from './defaults';

export type CacheItem<T> = { version: number; languageId: string; createdAt: number; data: T };

export class MemoryCache<T> {
    private _itemsMap: Map<DocumentUri, CacheItem<T>> = new Map();

    constructor(private parse: (doc: TextDocument) => T, private maxEntries: number = DEFAULT_MAX_OPEN_FILES) {}

    get(document: TextDocument): T {
        const itemInfo = this._itemsMap.get(document.uri);
        if (itemInfo && itemInfo.version === document.version && itemInfo.languageId === document.languageId) {
            itemInfo.createdAt = Date.now();
            return itemInfo.data;
        }
        return this.set(document);
    }

    setOpenUris(openDoc: TextDocument[]) {
        openDoc.forEach((doc) => {
            if (!this._itemsMap.has(doc.uri)) {
                this.set(doc);
            }
        });
    }

    set(document: TextDocument) {
        const data = this.parse(document);
        this._itemsMap.set(document.uri, {
            data: data,
            version: document.version,
            languageId: document.languageId,
            createdAt: Date.now(),
        });
        this._validate();

        return data;
    }

    delete(uri: string) {
        this._itemsMap.delete(uri);
    }

    clear() {
        this._itemsMap.clear();
    }

    private _validate() {
        if (this._itemsMap.size === this.maxEntries) {
            let oldestTime = Number.MAX_VALUE;
            let oldestUri = null;
            for (const uri in this._itemsMap) {
                const itemInfo = this._itemsMap.get(uri);
                if (itemInfo && itemInfo.createdAt < oldestTime) {
                    oldestUri = uri;
                    oldestTime = itemInfo.createdAt;
                }
            }
            if (oldestUri) {
                this._itemsMap.delete(oldestUri);
            }
        }
    }
}

