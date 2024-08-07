'use strict';

import { Function } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';

export class FunctionVisitor implements NodeVisitor {
    private analyzer: Analyzer;

    constructor(analyzer: Analyzer) {
        this.analyzer = analyzer;
    }

    visit(fnNode: unknown): boolean {
        const node = fnNode as Function;

        // todo: Attribute, type
        const symbol = this.analyzer.createSymbol(node.name, SymbolKind.Function, node.loc);
        this.analyzer.addSymbol(symbol);

        this.analyzer.member = undefined;
        return true;
    }
}

