'use strict';

import { laraphenseRc } from '../baseLang';
import { FlatDocument } from '../../support/document';
import { Fetcher } from '../../support/fetcher';
import { FileEntry, FolderKind, FolderUri, RelativeUri, WorkspaceFolder } from '../../support/workspaceFolder';
import { EventEmitter } from '../../support/eventEmitter';
import { FileCache } from '../../support/cache';
import { join } from 'path';
import { BladeParser } from '../../bladeParser/parser';
import { folderContainsUri } from '../../helpers/uri';
import { ProjectSpace, Space } from './ProjectSpace';

export class Indexer {
    private _fetcher: Fetcher;

    private stubsSpace: ProjectSpace;
    private projectSpaces: Map<FolderUri, ProjectSpace> = new Map();

    private _folderIndexingStarted: EventEmitter<{ uri: FolderUri; name: string; withFiles: number }>;
    private _folderIndexingEnded: EventEmitter<{ uri: FolderUri; name: string; withFiles: number }>;

    constructor(private config: laraphenseRc, public cache: FileCache | undefined, stubsUri: FolderUri) {
        this._fetcher = new Fetcher();

        this.stubsSpace = new ProjectSpace(stubsUri, new BladeParser());
        this.projectSpaces.set(stubsUri, this.stubsSpace);
        this.stubsSpace.indexFiles(this._fetcher);

        this._folderIndexingStarted = new EventEmitter();
        this._folderIndexingEnded = new EventEmitter();
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
            console.warn(`project folder not found for ${uri}`, Array.from(this.projectSpaces.keys()));
            return undefined;
        }

        let fileUri = uri.substring(folderUri.length + 1) as RelativeUri;

        return { project: this.projectSpaces.get(folderUri)!, folderUri, fileUri, uri };
    }

    public findFolderUriContainingUri(uri: string): FolderUri | undefined {
        for (const folderUri of this.projectSpaces.keys()) {
            if (folderContainsUri(folderUri, uri)) {
                return folderUri;
            }
        }

        return undefined;
    }

    private documentChanges: Map<string, FlatDocument> = new Map();

    // onDocumentChange(change: TextDocumentChangeEvent<TextDocument>) {
    //     const flatDocument = FlatDocument.fromTextDocument(change.document);
    //     this.documentChanges.set(change.document.uri, flatDocument);
    // }

    // async processDocumentChanges() {
    //     for (const [uri, flatDocument] of this.documentChanges) {
    //         const parsedData = this._compiler.compile(flatDocument);
    //         await this.fileCache.writeJson(uri, { version: flatDocument.version, data: parsedData });
    //         this._compiler.analyze(parsedData);
    //     }
    //     this.documentChanges.clear();
    // }

    // private async hasFileChanged(uri: string, cachedAt: number): Promise<boolean> {
    //     const stats = await stat(uriToPath(uri));
    //     return stats.mtimeMs > cachedAt;
    // }

    public async indexFolder(folder: WorkspaceFolder) {
        const files = await folder.findFiles();
        if (files.length < 1) {
            return;
        }

        if (folder.kind === FolderKind.User) {
            this._folderIndexingStarted.emit({ uri: folder.uri, name: folder.name, withFiles: files.length });
        }

        const context = new ProjectSpace(folder.uri, new BladeParser(this.config.phpVersion), this.stubsSpace);
        context.addFiles(files);
        this.projectSpaces.set(folder.uri, context);

        const { count, missingFiles } = await context.indexFiles(this._fetcher);

        context.linkPendingReferences();
        // console.log(context.referenceTable.pendingReferences);

        if (folder.kind === FolderKind.User) {
            this._folderIndexingEnded.emit({ uri: folder.uri, name: folder.name, withFiles: count });
        }

        if (missingFiles.length > 0) {
            console.log('missingFiles', missingFiles);
        }

        this.cache?.writeJson(join(folder.name, 'symbols'), context.symbolTable.saveForFile());
        this.cache?.writeJson(join(folder.name, 'references'), context.referenceTable.saveForFile());
        this.cache?.writeJson(join(folder.name, 'filesEntries'), files);
    }

    public async indexNewFile(folderUri: FolderUri, entry: FileEntry) {
        const context = this.projectSpaces.get(folderUri);
        if (!context) {
            throw new Error(`ProjectContext not found for folder: ${folderUri}`);
        }

        await context.indexNewFile(this._fetcher, entry);
    }
}

