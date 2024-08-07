'use strict';

import { FolderKind, FolderUri, RelativeUri, WorkspaceFolder } from './workspaceFolder';
import { DocContext, laraphenseRc } from '../languages/baseLang';
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE } from './defaults';
import { EventEmitter } from './eventEmitter';
import { URI } from 'vscode-uri';
import { folderContainsUri } from '../helpers/uri';

export class Workspace {
    private _folderNames: string[] = [];
    private _folders: Map<FolderUri, WorkspaceFolder> = new Map();
    private _folderAdded: EventEmitter<{ folder: WorkspaceFolder }>;
    private _fileAdded: EventEmitter<{ uri: string }>;
    private _fileRemoved: EventEmitter<{ uri: string }>;
    private _folderRemoved: EventEmitter<{ uri: FolderUri }>;

    constructor(private _config: laraphenseRc) {
        this._folderAdded = new EventEmitter(true);
        this._fileAdded = new EventEmitter();
        this._fileRemoved = new EventEmitter();
        this._folderRemoved = new EventEmitter();
    }

    public get config() {
        return this._config;
    }

    public get folderAdded() {
        return this._folderAdded;
    }

    public get folderRemoved() {
        return this._folderRemoved;
    }

    public set config(config: laraphenseRc) {
        this._config = config;
    }

    public get folders() {
        return this._folders;
    }

    public addFile(uri: string) {
        // this._files.set(uri);
        this._fileAdded.emit({
            uri,
        });
    }

    public removeFile(uri: string) {
        // this._files.delete(uri);
        this._fileRemoved.emit({
            uri,
        });
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

        const folder = new WorkspaceFolder(name, folderUri, _kind, _includeGlobs, _excludeGlobs);
        this._folders.set(folderUri, folder);
        this._folderAdded.emit({
            folder,
        });
    }

    public removeFolder(uri: string) {
        let folderUri = uri as FolderUri;

        if (this._folders.delete(folderUri)) {
            this._folderRemoved.emit({
                uri: folderUri,
            });
            this._folderRemoved.emit({
                uri: folderUri,
            });
            return true;
        }

        folderUri = URI.parse(uri).toString() as FolderUri;

        if (this._folders.delete(folderUri)) {
            this._folderRemoved.emit({
                uri: folderUri,
            });
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
}

