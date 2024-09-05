'use strict';

import { EnumCase } from 'php-parser';
import { SymbolExtractor, NodeVisitor } from '../../analyzer';
import { createSymbol } from '../../../../helpers/analyze';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';

export class EnumCaseVisitor implements NodeVisitor {
    constructor(private analyzer: SymbolExtractor) {}

    visit(node: EnumCase): boolean {
        this.analyzer.addSymbol(
            createSymbol(node.name, PhpSymbolKind.EnumMember, node.loc, this.analyzer.scope, [], undefined, node.value)
        );

        return false;
    }
}

