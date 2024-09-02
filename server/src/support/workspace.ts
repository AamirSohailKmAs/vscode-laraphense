'use strict';

import { FolderKind, FolderUri, WorkspaceFolder, RelativeUri, Space } from './workspaceFolder';
import { DocContext, laraphenseRc } from '../languages/baseLang';
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE, DEFAULT_STUBS } from './defaults';
import { EventEmitter } from './eventEmitter';
import { URI } from 'vscode-uri';
import { folderContainsUri } from '../helpers/uri';
import { join } from 'path';
import { BladeParser } from '../bladeParser/parser';
import { FileCache } from './cache';
import { Fetcher } from './fetcher';

export class Workspace {
    private _fetcher: Fetcher;
    private _folderNames: string[] = [];

    private stubsSpace: WorkspaceFolder;
    private _folders: Map<FolderUri, WorkspaceFolder> = new Map();

    private _folderIndexingStarted: EventEmitter<{ uri: FolderUri; name: string; withFiles: number }>;
    private _folderIndexingEnded: EventEmitter<{ uri: FolderUri; name: string; withFiles: number }>;

    constructor(private _config: laraphenseRc, public cache: FileCache | undefined, stubsUri: FolderUri) {
        this._fetcher = new Fetcher();

        this.stubsSpace = new WorkspaceFolder(
            'stubs',
            stubsUri,
            new BladeParser(),
            undefined,
            FolderKind.Stub,
            DEFAULT_STUBS
        );
        this._folders.set(stubsUri, this.stubsSpace);
        this.indexFolder(this.stubsSpace);

        this._folderIndexingStarted = new EventEmitter();
        this._folderIndexingEnded = new EventEmitter();
    }

    public get config() {
        return this._config;
    }

    public set config(config: laraphenseRc) {
        this._config = config;
    }

    public get folders() {
        return this._folders;
    }

    public addFile(uri: string) {
        // this._files.set(uri);
    }

    public removeFile(uri: string) {
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
            new BladeParser(this._config.phpVersion),
            this.stubsSpace,
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

    public splitUri(uri: string): { folderUri: FolderUri; fileUri: RelativeUri } | undefined {
        const folderUri = this.findFolderUriContainingUri(uri);

        if (!folderUri) return;

        let fileUri = uri.substring(folderUri.length + 1) as RelativeUri;

        return { folderUri, fileUri };
    }

    public findFolderContainingUri(uri: string): WorkspaceFolder | undefined {
        for (const [_folderUri, folder] of this._folders) {
            if (folder.contains(uri)) {
                return folder;
            }
        }

        return undefined;
    }

    public findFolderUriContainingUri(uri: string): FolderUri | undefined {
        for (const folderUri of this._folders.keys()) {
            if (folderContainsUri(folderUri, uri)) {
                return folderUri;
            }
        }

        return undefined;
    }

    public getDocumentContext(documentUri: string) {
        return new DocContext(Array.from(this._folders.keys()), documentUri);
    }

    public get folderIndexingStarted() {
        return this._folderIndexingStarted;
    }

    public get folderIndexingEnded() {
        return this._folderIndexingEnded;
    }

    public getProjectSpace(uri: string): Space | undefined {
        const folderUri = this.findFolderUriContainingUri(uri);

        if (!folderUri) {
            console.warn(`project folder not found for ${uri}`, Array.from(this._folders.keys()));
            return undefined;
        }

        let fileUri = uri.substring(folderUri.length + 1) as RelativeUri;

        return { folder: this._folders.get(folderUri)!, folderUri, fileUri, uri };
    }

    public async indexFolder(folder: WorkspaceFolder) {
        const files = await folder.findFiles();
        if (files.length < 1) {
            return;
        }

        if (folder.kind === FolderKind.User) {
            this._folderIndexingStarted.emit({ uri: folder.uri, name: folder.name, withFiles: files.length });
        }

        folder.addFiles(files);

        const { count, missingFiles } = await folder.indexFiles(this._fetcher);

        folder.linkPendingReferences();
        // console.log(folder.referenceTable.pendingReferences);

        if (folder.kind === FolderKind.User) {
            this._folderIndexingEnded.emit({ uri: folder.uri, name: folder.name, withFiles: count });
        }

        if (missingFiles.length > 0) {
            console.log('missingFiles', missingFiles);
        }

        this.cache?.writeJson(join(folder.name, 'symbols'), folder.symbolTable.saveForFile());
        this.cache?.writeJson(join(folder.name, 'references'), folder.referenceTable.saveForFile());
        this.cache?.writeJson(join(folder.name, 'filesEntries'), files);
    }
}

