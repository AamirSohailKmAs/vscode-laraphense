'use strict';

import { DocumentUri } from 'vscode-languageserver-textdocument';
import { FolderKind, WorkspaceFolder } from './workspaceFolder';
import { DocContext, laraphenseRc } from '../languages/baseLang';
import { FileCache } from '../support/cache';
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE } from '../support/defaults';
import { WordStore } from '../support/generator';
import { EventEmitter } from '../support/eventEmitter';

export class Workspace {
    private _cache?: FileCache = undefined;

    private _wordStore: WordStore;

    private _folders: Map<DocumentUri, WorkspaceFolder> = new Map();
    private _folderAdded: EventEmitter<{ folder: WorkspaceFolder }>;
    // private _fileAdded: EventEmitter;
    // private _fileRemoved: EventEmitter;
    private _folderRemoved: EventEmitter<{ uri: string }>;

    constructor(private _config: laraphenseRc) {
        this._wordStore = new WordStore();

        this._folderAdded = new EventEmitter(true);
        // this._fileAdded = new EventEmitter();
        // this._fileRemoved = new EventEmitter();
        this._folderRemoved = new EventEmitter();
    }

    public get config() {
        return this._config;
    }

    public get folderAdded() {
        return this._folderAdded;
    }

    public get folderRemoved() {
        return this._folderRemoved;
    }

    public set config(config: laraphenseRc) {
        this._config = config;
    }

    public set cache(cache: FileCache) {
        this._cache = cache;
    }

    public get folders() {
        return this._folders;
    }

    // public indexWorkspace() {
    //     // emit indexing started
    //     this._folders.forEach((folder) => {
    //         this.indexFolder(folder);
    //     });
    //     // emit indexing ended
    // }

    // public async indexFolder(folder: WorkspaceFolder) {
    //     await this._indexer.indexFolder(folder);
    //     folder.initLibraries();
    // }

    public addFolder(
        uri: string,
        _kind: FolderKind = FolderKind.User,
        _includeGlobs: string[] = DEFAULT_INCLUDE,
        _excludeGlobs: string[] = DEFAULT_EXCLUDE
    ) {
        const folder = new WorkspaceFolder(this._wordStore, uri, _kind, _includeGlobs, _excludeGlobs);
        this._folders.set(uri, folder);
        this._folderAdded.emit({
            folder,
        });
    }

    public removeFolder(uri: string) {
        this._folders.delete(uri);
        this._folderRemoved.emit({
            uri,
        });
    }

    public findFolderContainingUri(uri: string): WorkspaceFolder | undefined {
        for (const [_folderUri, folder] of this._folders) {
            if (folder.contains(uri)) {
                return folder;
            }
        }

        return undefined;
    }

    public getDocumentContext(documentUri: string) {
        return new DocContext(Array.from(this._folders.keys()), documentUri);
    }
}

