'use strict';
import { glob } from 'fast-glob';
import { uriToPath } from '../helpers/uri';
import { DEFAULT_INCLUDE, DEFAULT_EXCLUDE } from '../support/defaults';
import { join, sep } from 'path';
import { DocumentUri } from 'vscode-languageserver';
import { BladeParser } from '../bladeParser/parser';
import { createBatches } from '../helpers/general';
import { splitNamespace } from '../helpers/symbol';
import { Analyzer } from '../languages/php/analyzer';
import { ReferenceTable, PhpReference } from '../languages/php/indexing/tables/referenceTable';
import { SymbolTable, PhpSymbol } from '../languages/php/indexing/tables/symbolTable';
import { DocLang } from './document';
import { Fetcher } from './fetcher';
import { Library } from '../libraries/baseLibrary';
import { Laravel } from '../libraries/laravel';
import { NamespaceResolver } from '../languages/php/namespaceResolver';

export type FolderUri = string & { readonly FolderId: unique symbol };
export type RelativeUri = string & { readonly PathId: unique symbol };

export const enum FolderKind {
    User = 0,
    Stub = 1,
}

export type FileEntry = {
    uri: string;
    modified: number;
    size: number;
};

export type Space = {
    uri: DocumentUri;
    fileUri: RelativeUri;
    folderUri: FolderUri;
    folder: WorkspaceFolder;
};

export class WorkspaceFolder {
    public fetcher: Fetcher;
    public analyzer: Analyzer;
    public files: FileEntry[] = [];
    public symbolTable: SymbolTable;
    public referenceTable: ReferenceTable;
    public resolver: NamespaceResolver;

    private _libraries: Library[] = [];

    constructor(
        private _name: string,
        private _uri: string,
        private parser: BladeParser,
        private stubsFolder?: WorkspaceFolder,
        private _kind: FolderKind = FolderKind.User,
        private _includeGlobs: string[] = DEFAULT_INCLUDE,
        private _excludeGlobs: string[] = DEFAULT_EXCLUDE
    ) {
        this.fetcher = new Fetcher();
        this.symbolTable = new SymbolTable();
        this.referenceTable = new ReferenceTable();
        this.analyzer = new Analyzer(this.symbolTable, this.referenceTable);

        this.resolver = new NamespaceResolver(
            this.fetcher.loadUriIfLang(this.documentUri('composer.json'), [DocLang.json])?.getText() ?? '{}'
        );

        this._includeGlobs = _includeGlobs.map(this.uriToGlobPattern);
        this._excludeGlobs = this._excludeGlobs.map(this.uriToGlobPattern);

        if (this._uri.slice(-1) === '/') {
            this._uri = this._uri.slice(0, -1);
        }
    }

    public get name(): string {
        return this._name;
    }

    public get uri(): FolderUri {
        return this._uri as FolderUri;
    }

    public get kind(): FolderKind {
        return this._kind;
    }

    public get includeGlobs(): string[] {
        return this._includeGlobs;
    }

    public get excludeGlobs(): string[] {
        return this._excludeGlobs;
    }

    public get isStubs() {
        return this._kind === FolderKind.Stub;
    }

    public get vendorUri() {
        return this._uri + '/vendor';
    }

    public get libraries() {
        return this._libraries;
    }

    public isVendorFile(uri: string) {
        return uri.indexOf('/vendor/') !== -1;
    }

    public relativePath(uri: DocumentUri): RelativeUri {
        return uri.replace(this._uri + sep, '') as RelativeUri;
    }

    public documentUri(uri: string): DocumentUri {
        return join(this._uri, uri);
    }

    public documentPath(uri: string): string {
        return uriToPath(join(this._uri, uri));
    }

    public async findFiles(): Promise<FileEntry[]> {
        const entries = await glob(this._includeGlobs, {
            stats: true,
            cwd: uriToPath(this._uri) + sep,
            ignore: this._excludeGlobs,
            dot: true,
            suppressErrors: true,
        });

        return entries.map((entry) => ({
            uri: entry.path,
            modified: entry.stats ? entry.stats.mtime.getTime() : 0,
            size: entry.stats ? entry.stats.size : 0,
        }));
    }

    public uriToGlobPattern(name: string) {
        if (name.indexOf('/') === -1) {
            return '**/' + name + '/*'; // .php and .blade file, I know .blade isn't something for now
        } else {
            return name;
        }
    }

    public addFiles(files: FileEntry[]) {
        this.files.push(...files);
    }

    public async indexFiles() {
        let count = 0;
        const missingFiles: Array<{ uri: string; reason: string }> = [];

        const fileBatches = createBatches(this.files, 10);
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

                    const compiled = this.indexFile(entry);

                    if (!compiled) {
                        missingFiles.push({ uri: entry.uri, reason: "can't compile" });
                        return;
                    }
                    this.symbolTable.addSymbols(compiled.symbols);
                    this.referenceTable.addReferences(compiled.references);
                    this.referenceTable.addImports(compiled.importStatements);

                    count++;
                })
            );
        }

        this.initLibraries();

        return { count, missingFiles };
    }

    public linkPendingReferences() {
        const references = this.referenceTable.pendingReferences;
        const stillPending: PhpReference[] = [];
        for (let i = 0, l = references.length; i < l; i++) {
            if (!this.linkReference(references[i])) {
                stillPending.push(references[i]);
            }
        }

        this.referenceTable.pendingReferences = stillPending;
    }

    private linkReference(reference: PhpReference) {
        const symbol = this.findSymbolForReference(reference);

        if (!symbol) return false;

        reference.symbolId = symbol.id;
        symbol.referenceIds.push(reference.id);
        return true;
    }

    public findSymbolForReference(reference: PhpReference): PhpSymbol | undefined {
        if (this.stubsFolder) {
            let symbol = this.findReferenceFromTable(this.stubsFolder.symbolTable, reference);
            if (symbol) return symbol;
        }

        let symbol = this.findReferenceFromTable(this.symbolTable, reference);
        if (symbol) return symbol;

        return undefined;
    }

    private findReferenceFromTable(table: SymbolTable, reference: PhpReference) {
        let symbol = table.findSymbolByFqn(reference.fqn);
        if (symbol) return symbol;
        symbol = table.findSymbolByFqn(reference.definedIn);
        if (symbol) return symbol;
        symbol = table.findSymbolByFqn(splitNamespace(reference.name));
        if (symbol) return symbol;
        symbol = table.findSymbolByScopeName('', reference.name);
        if (symbol) return symbol;
    }

    private indexFile(entry: FileEntry) {
        const flatDoc = this.fetcher.loadUriIfLang(join(this._uri, entry.uri), [DocLang.php, DocLang.blade]);

        if (flatDoc === undefined) {
            return undefined;
        }

        const astTree = this.parser.parseFlatDoc(flatDoc);
        const { symbols, references, importStatements } = this.analyzer.analyse(astTree, entry.uri as RelativeUri);
        flatDoc.lastCompile = process.hrtime();

        // Link references to stubs if necessary
        if (this.stubsFolder) {
            references.forEach((reference) => {
                const symbol = this.stubsFolder!.symbolTable.findSymbolByScopeName('\\', reference.name);
                if (symbol) {
                    reference.symbolId = symbol.id;
                    symbol.referenceIds.push(reference.id);
                }
            });
        }

        return { astTree, symbols, references, importStatements };
    }

    private initLibraries() {
        if (this.isStubs) {
            return;
        }

        const laravel = Laravel.make(this);
        if (laravel) this._libraries.push(laravel);
    }
}

