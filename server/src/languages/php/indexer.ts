'use strict';

import { DocumentUri } from 'vscode-languageserver';
import { laraphenseRc } from '../baseLang';
import { Analyzer } from './analyzer';
import { DocLang, FlatDocument } from '../../support/document';
import { Fetcher } from '../../support/fetcher';
import { FileEntry, FolderUri, RelativeUri, WorkspaceFolder } from '../../support/workspaceFolder';
import { PhpSymbol, SymbolTable } from './indexing/tables/symbolTable';
import { PhpReference, ReferenceTable } from './indexing/tables/referenceTable';
import { EventEmitter } from '../../support/eventEmitter';
import { FileCache } from '../../support/cache';
import { join } from 'path';
import { BladeParser } from '../../bladeParser/parser';
import { folderContainsUri } from '../../helpers/uri';

export class Indexer {
    private _fetcher: Fetcher;

    private stubsSpace: ProjectSpace;
    private projectSpaces: Map<FolderUri, ProjectSpace> = new Map();

    private _indexingStarted: EventEmitter<{}>;
    private _indexingEnded: EventEmitter<{ filesCount: number }>;
    private _folderIndexingStarted: EventEmitter<{ uri: FolderUri; withFiles: number }>;
    private _folderIndexingEnded: EventEmitter<{ uri: FolderUri; filesCount: number }>;

    constructor(private config: laraphenseRc, public cache: FileCache | undefined, stubsUri: FolderUri) {
        this._fetcher = new Fetcher();

        this.stubsSpace = new ProjectSpace(stubsUri, new BladeParser());
        this.projectSpaces.set(stubsUri, this.stubsSpace);
        this.stubsSpace.indexFiles(this._fetcher);

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

    public getProjectSpace(
        uri: string
    ): { project: ProjectSpace; folderUri: FolderUri; fileUri: RelativeUri } | undefined {
        const folderUri = this.findFolderUriContainingUri(uri);

        if (!folderUri) return undefined;

        let fileUri = uri.substring(folderUri.length + 1) as RelativeUri;

        return { project: this.projectSpaces.get(folderUri)!, folderUri, fileUri };
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

        this._folderIndexingStarted.emit({ uri: folder.uri, withFiles: files.length });
        console.log(`indexing Folder [${folder.uri}] having files [${files.length}]`);

        const context = new ProjectSpace(folder.uri, new BladeParser(this.config.phpVersion), this.stubsSpace);
        context.addFiles(files);
        this.projectSpaces.set(folder.uri, context);

        const { count, missingFiles } = await context.indexFiles(this._fetcher);

        this._folderIndexingEnded.emit({ uri: folder.uri, filesCount: count });
        console.log(`folder [${folder.uri}] indexing completed with files [${count}]`);
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

    public resolveReference(reference: PhpReference, folderUri: FolderUri): PhpSymbol | undefined {
        const context = this.projectSpaces.get(folderUri);
        if (!context) {
            throw new Error(`ProjectContext not found for folder: ${folderUri}`);
        }

        return context.resolveReference(reference);
    }
}

// similar to work space
class ProjectSpace {
    public analyzer: Analyzer;
    public files: FileEntry[] = [];
    public symbolTable: SymbolTable;
    public referenceTable: ReferenceTable;

    constructor(private folderUri: FolderUri, private parser: BladeParser, private stubsContext?: ProjectSpace) {
        this.symbolTable = new SymbolTable();
        this.referenceTable = new ReferenceTable();
        this.analyzer = new Analyzer(this.symbolTable, this.referenceTable);
    }

    public addFiles(files: FileEntry[]) {
        this.files.push(...files);
    }

    public async indexFiles(fetcher: Fetcher) {
        let count = 0;
        const missingFiles: Array<{ uri: string; reason: string }> = [];

        const fileBatches = this.createBatches(this.files, 10);
        for (const batch of fileBatches) {
            await Promise.all(
                batch.map(async (entry) => {
                    // if (entry.size > this.config.maxFileSize) {
                    //     console.warn(
                    //         `${entry.uri} has ${entry.size} bytes which is over the maximum file size of ${this.config.maxFileSize} bytes.`
                    //     );
                    //     count++;
                    //     missingFiles.push({ uri: entry.uri, reason: 'large file size' });
                    //     return; // maybe is shouldn't return
                    // }

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

                    const compiled = this.indexFile(fetcher, entry);

                    if (!compiled) {
                        missingFiles.push({ uri: entry.uri, reason: "can't compile" });
                        return;
                    }
                    this.symbolTable.addSymbols(compiled.symbols);
                    this.referenceTable.addReferences(compiled.references);

                    count++;
                })
            );
        }

        return { count, missingFiles };
    }

    public async indexNewFile(fetcher: Fetcher, entry: FileEntry) {
        const compiled = this.indexFile(fetcher, entry);
        if (!compiled) {
            return;
        }
        this.symbolTable.addSymbols(compiled.symbols);
        this.referenceTable.addReferences(compiled.references);
    }

    public resolveReference(reference: PhpReference): PhpSymbol | undefined {
        const symbol = this.symbolTable.getSymbolById(reference.symbolId);
        if (symbol) {
            return symbol;
        }

        if (this.stubsContext) {
            return this.stubsContext.symbolTable.getSymbolById(reference.symbolId);
        }

        return undefined;
    }

    private indexFile(fetcher: Fetcher, entry: FileEntry) {
        const flatDoc = fetcher.loadUriIfLang(join(this.folderUri, entry.uri), [DocLang.php, DocLang.blade]);

        if (flatDoc === undefined) {
            return undefined;
        }

        const astTree = this.parser.parseFlatDoc(flatDoc);
        const { symbols, references } = this.analyzer.analyse(astTree, entry.uri as RelativeUri);
        flatDoc.lastCompile = process.hrtime();

        // Link references to stubs if necessary
        if (this.stubsContext) {
            references.forEach((reference) => {
                const symbol = this.stubsContext!.symbolTable.findSymbolByFqn('\\', reference.name);
                if (symbol) {
                    reference.symbolId = symbol.id;
                    symbol.referenceIds.push(reference.id);
                }
            });
        }

        return { astTree, symbols, references };
    }

    private createBatches<T>(array: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }
        return batches;
    }
}

