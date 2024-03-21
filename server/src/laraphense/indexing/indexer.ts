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

            const compiled = this._compiler.compileUri(entry.uri, folder);
            if (!compiled) {
                missingFiles.push({ uri: entry.uri, reason: 'can not compile' });
                continue;
            }
            count++;
            this._indexCount++;
        }

        console.log(`folder [${folder.uri}] indexing completed with files [${count}]`);
        if (missingFiles.length > 0) {
            console.log('missingFiles', missingFiles);
        }
    }
}

