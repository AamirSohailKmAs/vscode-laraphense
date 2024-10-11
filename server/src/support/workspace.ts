'use strict';

import { FolderKind, FolderUri, WorkspaceFolder, RelativeUri, Space } from './workspaceFolder';
import { laraphenseRc } from '../languages/baseLang';
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE, DEFAULT_STUBS } from './defaults';
import { EventEmitter } from './eventEmitter';
import { URI } from 'vscode-uri';
import { folderContainsUri } from '../helpers/uri';
import { FileCache } from './cache';

export class Workspace {
    private _folderNames: string[] = [];

    private _stubsFolder: WorkspaceFolder;
    private _folders: Map<FolderUri, WorkspaceFolder> = new Map();

    private _folderIndexingStarted: EventEmitter<{ uri: FolderUri; name: string; withFiles: number }>;
    private _folderIndexingEnded: EventEmitter<{ uri: FolderUri; name: string; withFiles: number }>;

    constructor(public config: laraphenseRc, private cache: FileCache, stubsUri: FolderUri) {
        this._stubsFolder = new WorkspaceFolder('stubs', stubsUri, cache, undefined, FolderKind.Stub, DEFAULT_STUBS);
        this.indexFolder(this._stubsFolder);

        this._folderIndexingStarted = new EventEmitter();
        this._folderIndexingEnded = new EventEmitter();
    }

    /**
     * Get folders excluding stubs folder
     */
    public get folders() {
        return this._folders;
    }

    public get folderIndexingStarted() {
        return this._folderIndexingStarted;
    }

    public get folderIndexingEnded() {
        return this._folderIndexingEnded;
    }

    public addFile(uri: string) {
        console.log(`watched File created: ${uri}`);
        // this._files.set(uri);
    }

    public removeFile(uri: string) {
        console.log(`watched File deleted: ${uri}`);
        // this._files.delete(uri);
    }

    public addFolder(
        name: string,
        uri: string,
        _kind: FolderKind = FolderKind.User,
        _includeGlobs: string[] = DEFAULT_INCLUDE,
        _excludeGlobs: string[] = DEFAULT_EXCLUDE
    ) {
        const folderUri = URI.parse(uri).toString() as FolderUri;

        name = this._folderNames.includes(name) ? `${name}_${Math.round(Math.random() * 10)}` : name;

        this._folderNames.push(name);

        const folder = new WorkspaceFolder(
            name,
            folderUri,
            this.cache,
            this._stubsFolder.db,
            _kind,
            _includeGlobs,
            _excludeGlobs
        );
        this._folders.set(folderUri, folder);
        this.indexFolder(folder);
    }

    public removeFolder(uri: string) {
        let folderUri = uri as FolderUri;

        if (this._folders.delete(folderUri)) {
            return true;
        }

        folderUri = URI.parse(uri).toString() as FolderUri;

        if (this._folders.delete(folderUri)) {
            return true;
        }

        return false;
    }

    public getProjectSpace(uri: string): Space | undefined {
        const result = this.findFolderContainingUri(uri);

        if (!result) {
            console.warn(`project folder not found for ${uri}`, Array.from(this._folders.keys()));
            return undefined;
        }

        let fileUri = uri.substring(result.folderUri.length + 1) as RelativeUri;

        return { ...result, fileUri, uri };
    }

    public async indexFolder(folder: WorkspaceFolder) {
        const files = await folder.findFiles();
        if (files.length < 1) {
            return;
        }

        if (await folder.readFromCache(files)) {
            return;
        }

        if (!folder.isStubs) {
            this._folderIndexingStarted.emit({ uri: folder.uri, name: folder.name, withFiles: files.length });
        }

        const { count } = await folder.index(files);

        if (!folder.isStubs) {
            this._folderIndexingEnded.emit({ uri: folder.uri, name: folder.name, withFiles: count });
        }
    }

    private findFolderContainingUri(uri: string): { folderUri: FolderUri; folder: WorkspaceFolder } | undefined {
        for (const [folderUri, folder] of this._folders) {
            if (folderContainsUri(folderUri, uri)) {
                return { folder, folderUri };
            }
        }

        return undefined;
    }
}

