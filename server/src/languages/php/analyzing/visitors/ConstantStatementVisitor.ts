'use strict';

import { ConstantStatement } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { createSymbol } from '../../../../helpers/analyze';
import { SymbolKind } from '../../indexing/tables/symbolTable';

export class ConstantStatementVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(node: ConstantStatement): boolean {
        for (let i = 0; i < node.constants.length; i++) {
            const constant = node.constants[i];
            this.analyzer.addSymbol(
                createSymbol(constant.name, SymbolKind.Constant, constant.loc, this.analyzer.scope, [], constant.value)
            );
        }
        return false;
    }
}
