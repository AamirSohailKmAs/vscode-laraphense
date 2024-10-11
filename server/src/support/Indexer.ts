'use strict';

import { BladeParser } from '@porifa/blade-parser';
import { Analyzer } from '../languages/php/analyzer';
import { ReferenceTable, PhpReference } from '../languages/php/indexing/tables/referenceTable';
import { PhpSymbolKind, PhpSymbol, SymbolTable } from '../languages/php/indexing/tables/symbolTable';
import { NamespaceResolver } from '../languages/php/namespaceResolver';
import { parseDoc } from './Compiler';
import { ASTDocument } from './document';
import { RelativeUri } from './workspaceFolder';
import { Database } from '../languages/php/indexing/Database';
import { SymbolReferenceLinker } from '../languages/php/SymbolReferenceLinker';

export class Indexer {
    private _analyzer: Analyzer;
    private _parser: BladeParser;
    private _linker: SymbolReferenceLinker;

    constructor(
        private _symbolTable: SymbolTable<PhpSymbolKind, PhpSymbol>,
        private _referenceTable: ReferenceTable<PhpSymbolKind, PhpReference>,
        private _namespaceResolver: NamespaceResolver,
        stubsDb?: Database
    ) {
        this._parser = new BladeParser();

        this._linker = new SymbolReferenceLinker(_symbolTable, _referenceTable, _namespaceResolver, stubsDb);

        this._analyzer = new Analyzer(this._linker);
    }

    compile(doc: ASTDocument, uri: RelativeUri, steps: number = 3) {
        // if (!oldSymbol) {
        //     return newSymbol;
        // }

        // if (newSymbol.kind !== oldSymbol.kind) {
        //     return newSymbol;
        // }

        // if (newSymbol.name === oldSymbol.name) {
        //     return;
        // }

        // if (newSymbol.name.startsWith(oldSymbol.name)) {
        //     this.rename(oldSymbol, newSymbol.name);
        // }
        const astTree = parseDoc(this._parser, doc);
        this._namespaceResolver.clearImports();
        this._analyzer.analyze(astTree, uri, steps);
        doc.lastCompile = process.hrtime();
    }
}

