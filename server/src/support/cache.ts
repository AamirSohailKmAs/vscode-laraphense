'use strict';

import { DocumentUri, TextDocument } from 'vscode-languageserver-textdocument';
import { DEFAULT_MAX_OPEN_FILES } from './defaults';
import { writeFile, readFile, unlink, emptyDir, ensureDir } from 'fs-extra';
import { join } from 'path';
import { runSafe } from '../helpers/general';
import { FlatDocument } from './document';

export type CacheItem<T> = { version: number; languageId: string; createdAt: number; data: T };

export class MemoryCache<T> {
    private _cleanupInterval: NodeJS.Timer | undefined = undefined;
    private _itemsMap: Map<DocumentUri, CacheItem<T>> = new Map();

    constructor(
        private parse: (doc: FlatDocument) => T,
        private maxEntries: number = DEFAULT_MAX_OPEN_FILES,
        ttl?: number
    ) {
        if (ttl) {
            this._cleanupInterval = setInterval(() => {
                const cutoffTime = Date.now() - ttl;
                this._itemsMap.forEach((model, uri) => {
                    if (model.createdAt < cutoffTime) {
                        this._itemsMap.delete(uri);
                    }
                });
            }, ttl);
        }
    }

    get(document: FlatDocument): T {
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
                this.set(FlatDocument.fromTextDocument(doc));
            }
        });
    }

    set(document: FlatDocument) {
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
        if (typeof this._cleanupInterval !== 'undefined') {
            clearInterval(this._cleanupInterval);
            this._cleanupInterval = undefined;
            this._itemsMap.clear();
        }
    }

    private _validate() {
        if (this._itemsMap.size === this.maxEntries) {
            let oldestTime = Number.MAX_VALUE;
            let oldestUri: DocumentUri | null = null;
            for (const [uri, itemInfo] of this._itemsMap) {
                if (itemInfo.createdAt < oldestTime) {
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

export class FileCache {
    constructor(private _dir: string) {}

    public get directory() {
        return this._dir;
    }

    public fullPath(path: string) {
        return join(this._dir, path);
    }

    public async read(key: string): Promise<string> {
        return readFile(this.fullPath(key), 'utf-8');
    }

    public async readJson<T>(key: string): Promise<T | undefined> {
        return runSafe(
            async () => {
                const data = await this.read(key);
                return JSON.parse(data);
            },
            undefined,
            `Failed to read JSON from cache`
        );
    }

    public async write(key: string, data: string) {
        return writeFile(this.fullPath(key), data, 'utf-8');
    }

    public async writeJson<T>(key: string, data: T) {
        return this.write(key, JSON.stringify(data, null, 2));
    }

    public async delete(key: string) {
        return unlink(this.fullPath(key));
    }

    public async clear() {
        return runSafe(
            async () => {
                await emptyDir(this._dir);
                return this;
            },
            undefined,
            `Failed to clear workspace cache`
        );
    }

    public static async create(path: string) {
        return runSafe(
            async () => {
                await ensureDir(path);
                return new FileCache(path);
            },
            undefined,
            `Failed to get workspace cache at ${path}`
        );
    }
}

