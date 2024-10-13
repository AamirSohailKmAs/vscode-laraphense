'use strict';
import { glob } from 'fast-glob';
import { uriToPath } from '../helpers/uri';
import { DEFAULT_INCLUDE, DEFAULT_EXCLUDE, DEFAULT_MAX_FILE_SIZE, DEFAULT_PHP_VERSION } from '../support/defaults';
import { join, sep } from 'path';
import { DocumentUri } from 'vscode-languageserver';
import { createBatches } from '../helpers/general';
import { DocLang } from './document';
import { Fetcher } from './fetcher';
import { Library } from '../libraries/baseLibrary';
import { Laravel } from '../libraries/laravel';
import { laraphenseSetting } from '../languages/baseLang';
import { FileCache } from './cache';
import { Indexer, Steps } from './Indexer';
import { Database } from '../languages/php/indexing/Database';

export type FolderUri = string & { readonly FolderId: unique symbol };
export type RelativeUri = string & { readonly PathId: unique symbol };

export const enum FolderKind {
    User = 0,
    Stub = 1,
}

export type FileEntry = {
    uri: RelativeUri;
    size: number;
};

export type Space = {
    uri: DocumentUri;
    fileUri: RelativeUri;
    folderUri: FolderUri;
    folder: WorkspaceFolder;
};

export class WorkspaceFolder {
    public fetcher: Fetcher; // todo: move into indexer
    public db: Database;

    private count = 0;

    public indexer: Indexer;
    private _files: Set<RelativeUri> = new Set();
    private _libraries: Library[] = [];
    public config: laraphenseSetting = { maxFileSize: DEFAULT_MAX_FILE_SIZE, phpVersion: DEFAULT_PHP_VERSION };

    constructor(
        private _name: string,
        private _uri: string,
        private cache: FileCache,
        stubsDb?: Database,
        private _kind: FolderKind = FolderKind.User,
        private _includeGlobs: string[] = DEFAULT_INCLUDE,
        private _excludeGlobs: string[] = DEFAULT_EXCLUDE
    ) {
        this._includeGlobs = _includeGlobs.map(this.uriToGlobPattern);
        this._excludeGlobs = this._excludeGlobs.map(this.uriToGlobPattern);

        if (this._uri.slice(-1) === '/') {
            this._uri = this._uri.slice(0, -1);
        }

        this.fetcher = new Fetcher(this._uri);

        this.indexer = new Indexer(this.fetcher, this.config, this.documentUri('composer.json'), stubsDb);

        this.db = new Database(this.indexer.symbolTable, this.indexer.referenceTable);
    }

    public get filesArray() {
        return Array.from(this._files.values());
    }

    public get name(): string {
        return this._name;
    }

    public get uri(): FolderUri {
        return this._uri as FolderUri;
    }

    public get isStubs() {
        return this._kind === FolderKind.Stub;
    }

    public get vendorUri() {
        return this._uri + '/vendor';
    }

    public get libraries() {
        return this._libraries;
    }

    public isVendorFile(uri: string) {
        return uri.indexOf('/vendor/') !== -1;
    }

    public documentUri(uri: string): DocumentUri {
        return join(this._uri, uri);
    }

    public async findFiles(): Promise<FileEntry[]> {
        const entries = await glob(this._includeGlobs, {
            stats: true,
            cwd: uriToPath(this._uri) + sep,
            ignore: this._excludeGlobs,
            dot: true,
            suppressErrors: true,
        });

        return entries.map((entry) => ({
            uri: entry.path as RelativeUri,
            size: entry.stats ? entry.stats.size : 0,
        }));
    }

    public async index(files: FileEntry[]) {
        // todo: refactor
        this.count = 0;

        const fileBatches = createBatches(files, 10);
        for (const batch of fileBatches) {
            await Promise.all(batch.map(this.indexEntry.bind(this)));
        }

        this.initLibraries();

        this.writeToCache();

        return { count: this.count };
    }

    public async readFromCache(fileEntries: FileEntry[]) {
        // todo: refactor
        const symbols = await this.cache.readJson<string>(join(this.name, 'symbols'));
        const references = await this.cache.readJson<string>(join(this.name, 'references'));
        const filesUris = await this.cache.readJson<RelativeUri[]>(join(this.name, 'filesEntries'));

        if (!filesUris || !symbols || !references || fileEntries.length !== filesUris.length) {
            return false;
        }

        const uriSet = new Set(filesUris);

        if (fileEntries.some((entry) => !uriSet.has(entry.uri))) {
            return false;
        }

        if (!this.db.symbolTable.loadFromFile(symbols)) {
            return false;
        }
        if (!this.db.referenceTable.loadFromFile(references)) {
            return false;
        }

        this._files = uriSet;

        return true;
    }

    public writeToCache() {
        // todo: refactor
        this.cache.writeJson(join(this.name, 'symbols'), this.db.symbolTable.saveForFile());
        this.cache.writeJson(join(this.name, 'references'), this.db.referenceTable.saveForFile());
        this.cache.writeJson(join(this.name, 'filesEntries'), this.filesArray);
    }

    private async indexEntry(entry: FileEntry) {
        this._files.add(entry.uri);

        this.indexer.indexEntry(entry, this.isStubs ? Steps.Symbols : Steps.References);

        this.count++;
    }

    private uriToGlobPattern(name: string) {
        if (name.indexOf('/') === -1) {
            return '**/' + name + '/*';
        } else {
            return name;
        }
    }

    private initLibraries() {
        if (this.isStubs) {
            return;
        }

        const laravel = Laravel.make(this);
        if (laravel) this._libraries.push(laravel);
    }
}

