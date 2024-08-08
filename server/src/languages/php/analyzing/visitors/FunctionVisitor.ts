'use strict';

import { Function } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';
import { createSymbol } from '../../../../helpers/analyze';

export class FunctionVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(fnNode: unknown): boolean {
        const node = fnNode as Function;

        // todo: Attribute, type
        const symbol = this.analyzer.addSymbol(
            createSymbol(node.name, SymbolKind.Function, node.loc, this.analyzer.scope)
        );

        this.analyzer.member = symbol;
        return true;
    }
}

