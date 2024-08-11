'use strict';

import { join } from 'path';
import { DocumentUri } from 'vscode-languageserver-textdocument';
import { BladeParser } from '../../bladeParser/parser';
import { DocLang } from '../../support/document';
import { Fetcher } from '../../support/fetcher';
import { FolderUri, RelativeUri, FileEntry } from '../../support/workspaceFolder';
import { Analyzer } from './analyzer';
import { ReferenceTable, PhpReference } from './indexing/tables/referenceTable';
import { SymbolTable, PhpSymbol } from './indexing/tables/symbolTable';

export type Space = {
    project: ProjectSpace;
    folderUri: FolderUri;
    fileUri: RelativeUri;
    uri: DocumentUri;
};
// similar to work space
export class ProjectSpace {
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

    public linkPendingReferences() {
        const references = this.referenceTable.pendingReferencesArray;
        for (let i = 0, l = references.length; i < l; i++) {
            this.linkReference(references[i]);
        }
    }

    private linkReference(reference: PhpReference) {
        const symbol = this.findSymbolForReference(reference);

        if (!symbol) return false;

        reference.symbolId = symbol.id;
        symbol.referenceIds.push(reference.id);
    }

    public findSymbolForReference(reference: PhpReference): PhpSymbol | undefined {
        if (this.stubsContext) {
            const symbol = this.stubsContext.symbolTable.findSymbolByFqn(reference.fqn);
            if (symbol) return symbol;
        }

        return this.symbolTable.findSymbolByFqn(reference.fqn);
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
                const symbol = this.stubsContext!.symbolTable.findSymbolByScopeName('\\', reference.name);
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

