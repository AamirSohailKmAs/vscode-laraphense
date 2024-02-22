'use strict';
import { glob } from 'fast-glob';
import { pathToUri, uriToPath } from '../../helpers/uri';

export type FileEntry = {
    uri: string;
    modified: number;
    size: number;
};

export class WorkspaceFolder {
    private _uri: string;
    private _includeGlobs: string[];
    private _excludeGlobs: string[];

    constructor(uri: string, includeGlobs: string[], excludeGlobs: string[]) {
        this._uri = uri;
        this._includeGlobs = includeGlobs.map(this.uriToGlobPattern);
        this._excludeGlobs = excludeGlobs.map(this.uriToGlobPattern);
        if (this._uri.slice(-1) === '/') {
            this._uri = this._uri.slice(0, -1);
        }
    }

    public get uri(): string {
        return this._uri;
    }
    public get includeGlobs(): string[] {
        return this._includeGlobs;
    }
    public get excludeGlobs(): string[] {
        return this._excludeGlobs;
    }

    public async findFiles() {
        const entries = await glob(uriToPath(this._uri) + '/**', {
            stats: true,
            cwd: uriToPath(this._uri),
            ignore: this._excludeGlobs.map(this.uriToGlobPattern),
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

    public uriToGlobPattern(uri: string) {
        if (uri.indexOf('/') === -1) {
            return '**/' + uri;
        } else {
            return uri;
        }
    }
}

