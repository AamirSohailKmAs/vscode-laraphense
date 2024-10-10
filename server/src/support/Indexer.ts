'use strict';

import { BladeParser } from '@porifa/blade-parser';
import { Analyzer } from '../languages/php/analyzer';
import { ReferenceTable, PhpReference } from '../languages/php/indexing/tables/referenceTable';
import { PhpSymbolKind, PhpSymbol, SymbolTable } from '../languages/php/indexing/tables/symbolTable';
import { NamespaceResolver } from '../languages/php/namespaceResolver';
import { parseDoc } from './Compiler';
import { ASTDocument } from './document';
import { RelativeUri, WorkspaceFolder } from './workspaceFolder';

export class Indexer {
    private analyzer: Analyzer;
    private parser: BladeParser;

    constructor(
        private _symbolTable: SymbolTable<PhpSymbolKind, PhpSymbol>,
        private _referenceTable: ReferenceTable<PhpSymbolKind, PhpReference>,
        private namespaceResolver: NamespaceResolver,
        private stubsFolder?: WorkspaceFolder
    ) {
        this.parser = new BladeParser();
        this.analyzer = new Analyzer(this._symbolTable, this._referenceTable, this.namespaceResolver, stubsFolder);
    }

    compile(doc: ASTDocument, uri: RelativeUri, steps: number = 3) {
        const astTree = parseDoc(this.parser, doc);
        this.analyzer.analyze(astTree, uri, steps);
        doc.lastCompile = process.hrtime();
    }
}

