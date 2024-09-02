'use strict';

import { EnumCase } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { createSymbol } from '../../../../helpers/analyze';
import { SymbolKind } from '../../indexing/tables/symbolTable';

export class EnumCaseVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(node: EnumCase): boolean {
        this.analyzer.addSymbol(
            createSymbol(node.name, SymbolKind.EnumMember, node.loc, this.analyzer.scope, [], undefined, node.value)
        );

        return false;
    }
}

