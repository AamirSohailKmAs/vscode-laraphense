'use strict';

import { existsSync, readFileSync } from 'fs';
import { uriToPath } from '../../helpers/uri';

export class Fetcher {
    public getFileContent(uri: string) {
        const path = uriToPath(uri);
        if (!existsSync(path)) {
            return undefined;
        }
        return this._readFile(path);
    }

    private _readFile(path: string) {
        if (!existsSync(path)) {
            return undefined;
        }

        return readFileSync(path, { encoding: 'utf-8' }).toString();
    }
}

