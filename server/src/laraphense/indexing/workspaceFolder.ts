'use strict';
import { glob } from 'fast-glob';
import { folderContainsUri, pathToUri, uriToPath } from '../../helpers/uri';
import { FolderUri } from '../../types/general';
import { SymbolTable } from './tables/symbolTable';
import { DEFAULT_INCLUDE, DEFAULT_EXCLUDE } from '../../support/defaults';

export const enum FolderKind {
    User = 0,
    Stub = 1,
}

export type FileEntry = {
    uri: string;
    modified: number;
    size: number;
};

export class WorkspaceFolder {
    public symbolTable: SymbolTable;
    constructor(
        private _uri: string,
        private _kind: FolderKind = FolderKind.User,
        private _includeGlobs: string[] = DEFAULT_INCLUDE,
        private _excludeGlobs: string[] = DEFAULT_EXCLUDE
    ) {
        this._includeGlobs = _includeGlobs.map(this.uriToGlobPattern);
        this._excludeGlobs = this._excludeGlobs.map(this.uriToGlobPattern);

        if (this._uri.slice(-1) === '/') {
            this._uri = this._uri.slice(0, -1);
        }
        this.symbolTable = new SymbolTable();
    }

    public get uri(): FolderUri {
        return this._uri;
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

    public isVendorFile(uri: string) {
        return uri.indexOf('/vendor/') !== -1;
    }

    public async findFiles() {
        const entries = await glob(this._includeGlobs, {
            stats: true,
            cwd: uriToPath(this._uri) + '/',
            ignore: this._excludeGlobs,
            absolute: true,
            dot: true,
            suppressErrors: true,
        });

        return entries.map((entry) => ({
            uri: pathToUri(entry.path),
            modified: entry.stats ? entry.stats.mtime.getTime() : 0,
            size: entry.stats ? entry.stats.size : 0,
        }));
    }

    public uriToGlobPattern(name: string) {
        if (name.indexOf('/') === -1) {
            return '**/' + name + '/*.{php,blade.php}';
        } else {
            return name;
        }
    }

    contains(folder: string) {
        return folderContainsUri(folder, this._uri);
    }
}

