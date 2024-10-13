'use strict';

import { BladeParser } from '@porifa/blade-parser';
import { Analyzer } from '../languages/php/analyzer';
import { ReferenceTable, PhpReference } from '../languages/php/indexing/tables/referenceTable';
import { PhpSymbol, SymbolTable } from '../languages/php/indexing/tables/symbolTable';
import { NamespaceResolver } from '../languages/php/namespaceResolver';
import { parseDoc } from './Compiler';
import { ASTDocument, DocLang } from './document';
import { FileEntry, RelativeUri } from './workspaceFolder';
import { Database } from '../languages/php/indexing/Database';
import { SymbolReferenceLinker } from '../languages/php/SymbolReferenceLinker';
import { Fetcher } from './fetcher';
import { DocumentUri } from 'vscode-languageserver';
import { laraphenseSetting } from '../languages/baseLang';

export enum Steps {
    Symbols = 1,
    References = 2,
    Errors = 3,
}

export class Indexer {
    private missingFiles: Array<{ uri: RelativeUri; reason: string }> = [];
    private _analyzer: Analyzer;
    private _parser: BladeParser;
    private _linker: SymbolReferenceLinker;

    public symbolTable: SymbolTable<PhpSymbol>;
    public referenceTable: ReferenceTable<PhpReference>;
    public resolver: NamespaceResolver;

    constructor(
        private _fetcher: Fetcher,
        private _config: laraphenseSetting,
        jsonUri: DocumentUri,
        stubsDb?: Database
    ) {
        this.symbolTable = new SymbolTable((symbol: any) => {
            return {
                ...symbol,
                throws: new Set(Object.entries(symbol.throws)),
                relatedIds: new Set(Object.entries(symbol.relatedIds)),
                referenceIds: new Set(Object.entries(symbol.referenceIds)),
            };
        });
        this.referenceTable = new ReferenceTable();

        this.resolver = new NamespaceResolver(this._fetcher.loadUriIfLang(jsonUri, [DocLang.json])?.getText() ?? '{}');

        this._parser = new BladeParser(this._config.phpVersion);

        this._linker = new SymbolReferenceLinker(this.symbolTable, this.referenceTable, this.resolver, stubsDb);

        this._analyzer = new Analyzer(this._linker);
    }

    public async indexEntry(entry: FileEntry, steps: Steps) {
        if (entry.size > this._config.maxFileSize) {
            console.warn(
                `${entry.uri} has ${entry.size} bytes which is over the maximum file size of ${this._config.maxFileSize} bytes.`
            );
            this.missingFiles.push({ uri: entry.uri, reason: 'large file size' });
            return;
        }

        const doc = this._fetcher.loadRelativeUriIfLang(entry.uri, [DocLang.php, DocLang.blade]);

        if (doc === undefined) {
            this.missingFiles.push({ uri: entry.uri, reason: 'not found' });
            return;
        }

        this.compile(doc, entry.uri, steps);
    }

    compile(doc: ASTDocument, uri: RelativeUri, steps: Steps) {
        const astTree = parseDoc(this._parser, doc);

        this._linker.setUri(uri);

        this._analyzer.analyze(astTree, steps);
        doc.lastCompile = process.hrtime();

        this._linker.finalize();

        return astTree;
    }
}

