'use strict';

import { DocumentUri, TextDocument } from 'vscode-languageserver-textdocument';
import { Indexer } from './indexer';
import { WorkspaceFolder } from './workspaceFolder';
import { DocContext, laraphenseRc } from '../../languages/baseLang';
import { folderContainsUri } from '../../helpers/uri';
import { Compiler } from '../compiler';
import { Regions } from '../document';
import { FileCache } from '../../support/cache';

export class Workspace {
    private _cache?: FileCache = undefined;
    private _indexer: Indexer;
    private _compiler: Compiler;

    private _folders: Map<DocumentUri, WorkspaceFolder> = new Map();

    constructor(private _config: laraphenseRc) {
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
        this._folders.forEach((folder) => {
            this.indexFolder(folder);
        });
    }

    public async indexFolder(folder: WorkspaceFolder) {
        await this._indexer.indexFolder(folder);
    }

    public addFolder(folder: WorkspaceFolder) {
        this._folders.set(folder.uri, folder);
    }

    public removeFolder(uri: string) {
        this._folders.delete(uri);
    }

    public findFolderContainingUri(uri: string): WorkspaceFolder | undefined {
        for (const folderUri in this._folders.keys()) {
            if (folderContainsUri(folderUri, uri)) {
                return this._folders.get(folderUri);
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

