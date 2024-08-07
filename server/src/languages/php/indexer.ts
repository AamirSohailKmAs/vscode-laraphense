'use strict';

import { DocumentUri } from 'vscode-languageserver';
import { laraphenseRc } from '../baseLang';
import { Analyzer } from './analyzer';
import { DocLang, FlatDocument } from '../../support/document';
import { Fetcher } from '../../support/fetcher';
import { FileEntry, FolderUri, RelativeUri, WorkspaceFolder } from '../../support/workspaceFolder';
import { SymbolTable } from './indexing/tables/symbolTable';
import { ReferenceTable } from './indexing/tables/referenceTable';
import { EventEmitter } from '../../support/eventEmitter';
import { FileCache } from '../../support/cache';
import { join } from 'path';
import { BladeParser } from '../../bladeParser/parser';
export class Indexer {
    public fileMap: Map<FolderUri, FileEntry[]> = new Map();
    public symbolMap: Map<FolderUri, SymbolTable> = new Map();
    public referenceMap: Map<FolderUri, ReferenceTable> = new Map();

    private _fetcher: Fetcher;
    private _indexCount: number = 0;

    private _indexingStarted: EventEmitter<{}>;
    private _indexingEnded: EventEmitter<{}>;
    private _folderIndexingStarted: EventEmitter<{ uri: FolderUri }>;
    private _folderIndexingEnded: EventEmitter<{ uri: FolderUri; filesCount: number }>;

    constructor(private _parser: BladeParser, private config: laraphenseRc, private _fileCache: FileCache | undefined) {
        this._fetcher = new Fetcher();

        this._folderIndexingStarted = new EventEmitter();
        this._folderIndexingEnded = new EventEmitter();

        this._indexingEnded = new EventEmitter();
        this._indexingStarted = new EventEmitter(true);
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

    public async indexFolder(folder: WorkspaceFolder) {
        const files = await folder.findFiles();
        this.fileMap.set(folder.uri, files);

        if (files.length < 1) {
            return;
        }

        console.log(`indexing Folder [${folder.uri}] having files [${files.length}]`);

        this._folderIndexingStarted.emit({ uri: folder.uri });

        const symbolTable = new SymbolTable();
        const referenceTable = new ReferenceTable();
        this.referenceMap.set(folder.uri, referenceTable);
        this.symbolMap.set(folder.uri, symbolTable);

        const analyze = new Analyzer(symbolTable, referenceTable);

        const missingFiles: Array<{ uri: string; reason: string }> = [];

        let count = 0;

        const fileBatches = this.createBatches(files, 10);

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

                    const compiled = this.indexFile(analyze, folder.uri, entry);
                    if (!compiled) {
                        missingFiles.push({ uri: entry.uri, reason: "can't compile" });
                        return; // maybe is shouldn't return
                    }

                    symbolTable.addSymbols(compiled.symbols, folder.relativePath(entry.uri));

                    referenceTable.addReferences(compiled.references, folder.relativePath(entry.uri));

                    count++;
                    this._indexCount++;

                    // const filePath = join(folderPath, file);
                    // const documentUri = URI.file(filePath).toString();
                    // const flatDocument = await this.fetchDocument(documentUri);
                    // const cachedData = await this.fileCache.readJson<CacheItem<any>>(documentUri);

                    // if (
                    //     cachedData &&
                    //     cachedData.version === flatDocument.version &&
                    //     !(await this.hasFileChanged(documentUri, cachedData.createdAt))
                    // ) {
                    //     // Use cached data
                    //     this.compiler.analyze(cachedData.data);
                    // } else {
                    //     // Compile and cache data
                    //     const parsedData = this.compiler.compile(flatDocument);
                    //     await this.fileCache.writeJson(documentUri, {
                    //         version: flatDocument.version,
                    //         data: parsedData,
                    //     });
                    //     this.compiler.analyze(parsedData);
                    // }
                })
            );
        }

        this._folderIndexingEnded.emit({ uri: folder.uri, filesCount: count });

        console.log(`folder [${folder.uri}] indexing completed with files [${count}]`);

        if (missingFiles.length > 0) {
            console.log('missingFiles', missingFiles);
        }

        this._fileCache?.writeJson(join(folder.name, 'symbols'), symbolTable.saveForFile());
        this._fileCache?.writeJson(join(folder.name, 'references'), referenceTable.saveForFile());
        this._fileCache?.writeJson(join(folder.name, 'filesEntries'), files);
    }

    private indexFile(analyzer: Analyzer, folderUri: FolderUri, entry: FileEntry) {
        const flatDoc = this._fetcher.loadUriIfLang(join(folderUri, entry.uri), [DocLang.php, DocLang.blade]);

        if (flatDoc === undefined) {
            return undefined;
        }

        const astTree = this._parser.parseFlatDoc(flatDoc);

        const { symbols, references } = analyzer.analyse(astTree, entry.uri as RelativeUri);

        flatDoc.lastCompile = process.hrtime();

        return { astTree, symbols, references };
    }
}

