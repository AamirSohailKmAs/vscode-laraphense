'use strict';

import { laraphenseRc } from '../../languages/baseLang';
import { Compiler } from '../compiler';
import { WorkspaceFolder } from './workspaceFolder';
export class Indexer {
    private _indexCount: number = 0;

    constructor(private _compiler: Compiler, private config: laraphenseRc) {}

    public async indexFolder(folder: WorkspaceFolder) {
        const files = await folder.findFiles();

        console.log(`indexFolder [${folder.uri}] having files [${files.length}]`);

        if (files.length < 1) {
            return;
        }

        for (let i = 0; i < files.length; ++i) {
            const entry = files[i];
            if (entry.size > this.config.maxFileSize) {
                console.warn(
                    `${entry.uri} has ${entry.size} bytes which is over the maximum file size of ${this.config.maxFileSize} bytes.`
                );
                continue;
            }

            const compiled = this._compiler.compileUri(entry.uri, folder);
            if (!compiled) {
                continue;
            }
            this._indexCount++;
        }
    }
}

