'use strict';
import { glob } from 'fast-glob';
import { uriToPath } from '../helpers/uri';
import { DEFAULT_INCLUDE, DEFAULT_EXCLUDE, DEFAULT_MAX_FILE_SIZE, DEFAULT_PHP_VERSION } from '../support/defaults';
import { join, sep } from 'path';
import { DocumentUri } from 'vscode-languageserver';
import { createBatches } from '../helpers/general';
import { Analyzer } from '../languages/php/analyzer';
import { PhpReference, ReferenceTable } from '../languages/php/indexing/tables/referenceTable';
import { PhpSymbol, PhpSymbolKind, SymbolTable } from '../languages/php/indexing/tables/symbolTable';
import { DocLang } from './document';
import { Fetcher } from './fetcher';
import { Library } from '../libraries/baseLibrary';
import { Laravel } from '../libraries/laravel';
import { NamespaceResolver } from '../languages/php/namespaceResolver';
import { laraphenseSetting } from '../languages/baseLang';
import { FileCache } from './cache';
import { BladeParser } from '@porifa/blade-parser';
import { parseDoc } from './Compiler';

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
    private count = 0;
    private missingFiles: Array<{ uri: RelativeUri; reason: string }> = [];
    public fetcher: Fetcher;
    public analyzer: Analyzer;
    private _files: Set<RelativeUri> = new Set();
    public symbolTable: SymbolTable<PhpSymbolKind, PhpSymbol>;
    public referenceTable: ReferenceTable<PhpSymbolKind, PhpReference>;
    public resolver: NamespaceResolver;

    private _libraries: Library[] = [];
    private _config: laraphenseSetting = { maxFileSize: DEFAULT_MAX_FILE_SIZE, phpVersion: DEFAULT_PHP_VERSION };

    constructor(
        private _name: string,
        private _uri: string,
        private parser: BladeParser,
        private cache: FileCache,
        private stubsFolder?: WorkspaceFolder,
        private _kind: FolderKind = FolderKind.User,
        private _includeGlobs: string[] = DEFAULT_INCLUDE,
        private _excludeGlobs: string[] = DEFAULT_EXCLUDE
    ) {
        this.fetcher = new Fetcher();
        this.symbolTable = new SymbolTable((symbol: any) => {
            return {
                ...symbol,
                throws: new Set(Object.entries(symbol.throws)),
                relatedIds: new Set(Object.entries(symbol.relatedIds)),
                referenceIds: new Set(Object.entries(symbol.referenceIds)),
            };
        });
        this.referenceTable = new ReferenceTable();
        this.resolver = new NamespaceResolver(
            this.fetcher.loadUriIfLang(this.documentUri('composer.json'), [DocLang.json])?.getText() ?? '{}'
        );

        this.analyzer = new Analyzer(this.symbolTable, this.referenceTable, this.resolver, stubsFolder);

        this._includeGlobs = _includeGlobs.map(this.uriToGlobPattern);
        this._excludeGlobs = this._excludeGlobs.map(this.uriToGlobPattern);

        if (this._uri.slice(-1) === '/') {
            this._uri = this._uri.slice(0, -1);
        }
    }

    public set config(config: laraphenseSetting) {
        this._config = config;
    }

    public get files() {
        return Array.from(this._files.values());
    }

    public get name(): string {
        return this._name;
    }

    public get uri(): FolderUri {
        return this._uri as FolderUri;
    }

    public get kind(): FolderKind {
        return this._kind;
    }

    public get includeGlobs(): string[] {
        return this._includeGlobs;
    }

    public get excludeGlobs(): string[] {
        return this._excludeGlobs;
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

    public relativePath(uri: DocumentUri): RelativeUri {
        return uri.replace(this._uri + sep, '') as RelativeUri;
    }

    public documentUri(uri: string): DocumentUri {
        return join(this._uri, uri);
    }

    public documentPath(uri: string): string {
        return uriToPath(join(this._uri, uri));
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

    private uriToGlobPattern(name: string) {
        if (name.indexOf('/') === -1) {
            return '**/' + name + '/*';
        } else {
            return name;
        }
    }

    public async indexFiles(files: FileEntry[]) {
        this.count = 0;

        const fileBatches = createBatches(files, 10);
        for (const batch of fileBatches) {
            await Promise.all(batch.map(this.indexEntry.bind(this)));
        }

        this.initLibraries();

        this.writeToCache();

        return { count: this.count, missingFiles: this.missingFiles };
    }

    public async readFromCache(files: FileEntry[]) {
        const symbols = await this.cache.readJson<string>(join(this.name, 'symbols'));
        const references = await this.cache.readJson<string>(join(this.name, 'references'));
        const filesEntries = await this.cache.readJson<RelativeUri[]>(join(this.name, 'filesEntries'));

        if (!filesEntries || !symbols || !references || files.length !== filesEntries.length) {
            return false;
        }

        // @todo check for files

        if (!this.symbolTable.loadFromFile(symbols)) {
            return false;
        }
        if (!this.referenceTable.loadFromFile(references)) {
            return false;
        }

        return true;
    }

    public writeToCache() {
        this.cache.writeJson(join(this.name, 'symbols'), this.symbolTable.saveForFile());
        this.cache.writeJson(join(this.name, 'references'), this.referenceTable.saveForFile());
        this.cache.writeJson(join(this.name, 'filesEntries'), this.files);
    }

    private async indexEntry(entry: FileEntry) {
        if (entry.size > this._config.maxFileSize) {
            console.warn(
                `${entry.uri} has ${entry.size} bytes which is over the maximum file size of ${this._config.maxFileSize} bytes.`
            );
            this.missingFiles.push({ uri: entry.uri, reason: 'large file size' });
            return;
        }

        const flatDoc = this.fetcher.loadUriIfLang(this.documentUri(entry.uri), [DocLang.php, DocLang.blade]);

        if (flatDoc === undefined) {
            this.missingFiles.push({ uri: entry.uri, reason: 'not found' });
            return undefined;
        }

        this._files.add(entry.uri);

        const astTree = parseDoc(this.parser, flatDoc);
        this.analyzer.analyze(astTree, entry.uri, this.isStubs ? 1 : 2);
        flatDoc.lastCompile = process.hrtime();

        this.count++;
    }

    private initLibraries() {
        if (this.isStubs) {
            return;
        }

        const laravel = Laravel.make(this);
        if (laravel) this._libraries.push(laravel);
    }
}

