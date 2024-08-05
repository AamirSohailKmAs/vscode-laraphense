'use strict';

import { DocumentUri, TextDocumentChangeEvent } from 'vscode-languageserver';
import { laraphenseRc } from '../baseLang';
import { Compiler } from '../../support/compiler';
import { DocLang, FlatDocument } from '../../support/document';
import { Fetcher } from '../../support/fetcher';
import { FolderKind, FolderUri, WorkspaceFolder } from '../../support/workspaceFolder';
import { SymbolKind, SymbolTable } from './indexing/tables/symbolTable';
import { ReferenceTable } from './indexing/tables/referenceTable';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { EventEmitter } from '../../support/eventEmitter';
export class Indexer {
    private _fetcher: Fetcher;
    public symbolMap: Map<FolderUri, SymbolTable> = new Map();
    public referenceMap: Map<FolderUri, ReferenceTable> = new Map();
    private _indexCount: number = 0;

    private _indexingStarted: EventEmitter<{}>;
    private _indexingEnded: EventEmitter<{}>;
    private _folderIndexingStarted: EventEmitter<{ uri: FolderUri }>;
    private _folderIndexingEnded: EventEmitter<{ uri: FolderUri; filesCount: number }>;

    constructor(private _compiler: Compiler, private config: laraphenseRc) {
        this._indexingStarted = new EventEmitter(true);
        this._indexingEnded = new EventEmitter();

        this._folderIndexingStarted = new EventEmitter();
        this._folderIndexingEnded = new EventEmitter();

        this._fetcher = new Fetcher();
    }

    public get indexingStarted() {
        return this._indexingStarted;
    }

    public get indexingEnded() {
        return this._indexingEnded;
    }

    public get folderIndexingStarted() {
        return this._folderIndexingStarted;
    }

    public get folderIndexingEnded() {
        return this._folderIndexingEnded;
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

    private createBatches<T>(array: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }
        return batches;
    }

    // private async hasFileChanged(uri: string, cachedAt: number): Promise<boolean> {
    //     const stats = await stat(uriToPath(uri));
    //     return stats.mtimeMs > cachedAt;
    // }

    // private async indexFolder(folderPath: string) {
    //     const files = await fastGlob('**/*.php', { cwd: folderPath });

    //     for (const file of files) {
    //         const filePath = join(folderPath, file);
    //         const documentUri = URI.file(filePath).toString();
    //         const flatDocument = await this.fetchDocument(documentUri);
    //         const cachedData = await this.fileCache.readJson<CacheItem<any>>(documentUri);

    //         if (
    //             cachedData &&
    //             cachedData.version === flatDocument.version &&
    //             !(await this.hasFileChanged(documentUri, cachedData.createdAt))
    //         ) {
    //             // Use cached data
    //             this.compiler.analyze(cachedData.data);
    //         } else {
    //             // Compile and cache data
    //             const parsedData = this.compiler.compile(flatDocument);
    //             await this.fileCache.writeJson(documentUri, { version: flatDocument.version, data: parsedData });
    //             this.compiler.analyze(parsedData);
    //         }
    //     }
    // }

    public async indexFolder(folder: WorkspaceFolder) {
        const files = await folder.findFiles();

        if (files.length < 1) {
            return;
        }

        console.log(`indexing Folder [${folder.uri}] having files [${files.length}]`);

        this._folderIndexingStarted.emit({ uri: folder.uri });

        const symbolTable = new SymbolTable();
        const referenceTable = new ReferenceTable();
        this.referenceMap.set(folder.uri, referenceTable);
        this.symbolMap.set(folder.uri, symbolTable);

        const missingFiles: Array<{ uri: string; reason: string }> = [];

        let count = 0;

        const fileBatches = this.createBatches(files, 10); // Create batches of 10 files

        for (const batch of fileBatches) {
            await Promise.all(
                batch.map(async (entry) => {
                    if (entry.size > this.config.maxFileSize) {
                        console.warn(
                            `${entry.uri} has ${entry.size} bytes which is over the maximum file size of ${this.config.maxFileSize} bytes.`
                        );
                        count++;
                        missingFiles.push({ uri: entry.uri, reason: 'large file size' });
                        return; // maybe is shouldn't return
                    }

                    const compiled = this.indexFile(entry.uri);
                    if (!compiled) {
                        missingFiles.push({ uri: entry.uri, reason: "can't compile" });
                        return; // maybe is shouldn't return
                    }

                    referenceTable.addReferences(compiled.references, folder.relativePath(entry.uri));

                    symbolTable.addSymbols(compiled.symbols, folder.relativePath(entry.uri));

                    count++;
                    this._indexCount++;
                })
            );
        }

        this._folderIndexingEnded.emit({ uri: folder.uri, filesCount: count });

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
