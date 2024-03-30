'use strict';

import { DocumentUri } from 'vscode-languageserver';
import { laraphenseRc } from '../baseLang';
import { Compiler } from '../../laraphense/compiler';
import { DocLang } from '../../laraphense/document';
import { Fetcher } from '../../laraphense/fetcher';
import { WorkspaceFolder } from '../../laraphense/workspaceFolder';
export class Indexer {
    private _fetcher: Fetcher;
    private _indexCount: number = 0;

    constructor(private _compiler: Compiler, private config: laraphenseRc) {
        this._fetcher = new Fetcher();
    }

    public async indexFolder(folder: WorkspaceFolder) {
        const files = await folder.findFiles();

        console.log(`indexing Folder [${folder.uri}] having files [${files.length}]`);

        if (files.length < 1) {
            return;
        }

        const missingFiles: Array<{ uri: string; reason: string }> = [];

        let count = 0;

        for (let i = 0; i < files.length; ++i) {
            const entry = files[i];
            if (entry.size > this.config.maxFileSize) {
                console.warn(
                    `${entry.uri} has ${entry.size} bytes which is over the maximum file size of ${this.config.maxFileSize} bytes.`
                );
                count++;
                continue;
            }

            const compiled = this.indexFile(entry.uri);
            if (!compiled) {
                continue;
            }

            folder.symbolTable.addSymbols(compiled.symbols, folder.relativePath(entry.uri));

            count++;
            this._indexCount++;
        }

        console.log(`folder [${folder.uri}] indexing completed with files [${count}]`);
        if (missingFiles.length > 0) {
            console.log('missingFiles', missingFiles);
        }
    }

    private indexFile(uri: DocumentUri) {
        const flatDoc = this._fetcher.loadUriIfLang(uri, [DocLang.php, DocLang.blade]);

        if (flatDoc === undefined) {
            return undefined;
        }

        return this._compiler.compileUri(flatDoc);
    }
}

