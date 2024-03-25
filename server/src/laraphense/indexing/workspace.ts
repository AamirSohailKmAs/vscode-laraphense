'use strict';

import { DocumentUri, TextDocument } from 'vscode-languageserver-textdocument';
import { Indexer } from './indexer';
import { FolderKind, WorkspaceFolder } from './workspaceFolder';
import { DocContext, laraphenseRc } from '../../languages/baseLang';
import { Compiler } from '../compiler';
import { Regions } from '../document';
import { FileCache } from '../../support/cache';
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE } from '../../support/defaults';
import { WordStore } from '../../support/generator';

export class Workspace {
    private _cache?: FileCache = undefined;
    private _indexer: Indexer;
    private _compiler: Compiler;
    private _wordStore: WordStore;

    private _folders: Map<DocumentUri, WorkspaceFolder> = new Map();

    constructor(private _config: laraphenseRc) {
        this._wordStore = new WordStore();
        this._compiler = new Compiler(this.config);
        this._indexer = new Indexer(this._compiler, this.config);
    }

    public get config() {
        return this._config;
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

    public indexWorkspace() {
        // emit indexing started
        this._folders.forEach((folder) => {
            this.indexFolder(folder);
        });
        // emit indexing ended
    }

    public async indexFolder(folder: WorkspaceFolder) {
        await this._indexer.indexFolder(folder);
        folder.initLibraries();
    }

    public addFolder(
        _uri: string,
        _kind: FolderKind = FolderKind.User,
        _includeGlobs: string[] = DEFAULT_INCLUDE,
        _excludeGlobs: string[] = DEFAULT_EXCLUDE
    ) {
        this._folders.set(_uri, new WorkspaceFolder(this._wordStore, _uri, _kind, _includeGlobs, _excludeGlobs));
    }

    public removeFolder(uri: string) {
        this._folders.delete(uri);
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

    public getRegions(doc: TextDocument) {
        return new Regions(doc.uri).parse(this._compiler.parseDoc(doc));
    }
}

