'use strict';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Workspace } from './indexing/workspace';
import { Indexer } from './indexing/indexer';
import { DEFAULT_MAX_FILE_SIZE } from '../support/defaults';

export class Laraphense {
    private _indexer: Indexer;

    constructor(private _workspace: Workspace) {
        this._indexer = new Indexer(this._workspace, DEFAULT_MAX_FILE_SIZE);
    }

    public setConfig(config?: any) {
        this._vsConfig = config;
    }

    public indexWorkspace(openUris: string[]) {
        this._indexer.indexWorkspace(openUris);
    }

    public shutdown() {}

    public onDocumentRemoved(document: TextDocument) {}
}
