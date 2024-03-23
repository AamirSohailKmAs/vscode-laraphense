'use strict';
import { glob } from 'fast-glob';
import { folderContainsUri, uriToPath } from '../../helpers/uri';
import { SymbolKind, SymbolTable } from './tables/symbolTable';
import { DEFAULT_INCLUDE, DEFAULT_EXCLUDE } from '../../support/defaults';
import { URI } from 'vscode-uri';
import { isAbsolute, join } from 'path';
import { Package } from '../../packages/basePackage';
import { Laravel } from '../../packages/laravel';
import { DocumentUri } from 'vscode-languageserver';
import { IdGenerator, WordStore } from '../../support/generator';
import { toFqsen } from './symbol';

/**
 * A tagging type for string properties that are actually Folder URI.
 */
export type FolderUri = string & { readonly FolderUri: unique symbol };

export const enum FolderKind {
    User = 0,
    Stub = 1,
}

export type FileEntry = {
    uri: string;
    modified: number;
    size: number;
};

// Define a type for the unique ID
export type RelativePathId = string & { readonly PathId: unique symbol };

export class WorkspaceFolder {
    public symbolTable: SymbolTable;
    private _libraries: Array<Package> = [];
    private _pathId: IdGenerator<RelativePathId>;

    constructor(
        private _wordStore: WordStore,
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
        this._pathId = new IdGenerator<RelativePathId>(this._wordStore, '/');
    }

    public initLibraries() {
        if (this.kind === FolderKind.Stub) {
            return;
        }
        this.enableLaravel();
    }

    public get libraries() {
        return this._libraries;
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

    public isVendorFile(uri: string) {
        return uri.indexOf('/vendor/') !== -1;
    }

    public relativePath(uri: DocumentUri): RelativePathId {
        return this._pathId.toId(uri.replace(this._uri + '/', ''));
    }

    public documentUri(uri: string): DocumentUri {
        return `${this._uri}/${uri}`;
    }

    public async findFiles() {
        const entries = await glob(this._includeGlobs, {
            stats: true,
            cwd: uriToPath(this._uri) + '/',
            ignore: this._excludeGlobs,
            dot: true,
            suppressErrors: true,
        });

        return entries.map((entry) => ({
            uri: this.documentUri(entry.path),
            modified: entry.stats ? entry.stats.mtime.getTime() : 0,
            size: entry.stats ? entry.stats.size : 0,
        }));
    }

    public uriToGlobPattern(name: string) {
        if (name.indexOf('/') === -1) {
            return '**/' + name + '/*.{php,blade}'; // .php and .blade file, I know .blade isn't something for now
        } else {
            return name;
        }
    }

    public contains(uri: string) {
        return folderContainsUri(this._uri, uri);
    }

    public absolutePath(path: string) {
        if (isAbsolute(path)) {
            return path;
        }
        let uri = URI.parse(this._uri).fsPath;
        return join(uri, path);
    }

    public pathToUri(path: string) {
        if (!path) {
            return this._uri;
        }
        let uri = URI.file(this.absolutePath(path)).toString();
        if (uri.slice(-1) === '/') {
            uri = uri.slice(0, -1);
        }
        return uri;
    }

    private enableLaravel() {
        // const version = this.symbolTable.getSymbolNested(
        //     toFqsen(SymbolKind.ClassConstant, 'VERSION', 'Illuminate\\Foundation\\Application')
        // )?.value;
        // if (version) {
        //     this._libraries.push(new Laravel(version, this));
        // }
    }
}

