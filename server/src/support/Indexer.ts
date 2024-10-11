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

export class Indexer {
    private analyzer: Analyzer;
    private parser: BladeParser;

    constructor(
        private _symbolTable: SymbolTable<PhpSymbolKind, PhpSymbol>,
        private _referenceTable: ReferenceTable<PhpSymbolKind, PhpReference>,
        private namespaceResolver: NamespaceResolver,
        private stubsDb?: Database
    ) {
        this.parser = new BladeParser();
        this.analyzer = new Analyzer(this._symbolTable, this._referenceTable, this.namespaceResolver, stubsDb);
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
        const astTree = parseDoc(this.parser, doc);
        this.analyzer.analyze(astTree, uri, steps);
        doc.lastCompile = process.hrtime();
    }
}

