'use strict';

import { ConstantStatement } from 'php-parser';
import { SymbolExtractor, NodeVisitor } from '../../analyzer';
import { createSymbol } from '../../../../helpers/analyze';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';

export class ConstantStatementVisitor implements NodeVisitor {
    constructor(private analyzer: SymbolExtractor) {}

    visit(node: ConstantStatement): boolean {
        for (let i = 0; i < node.constants.length; i++) {
            const constant = node.constants[i];
            this.analyzer.addSymbol(
                createSymbol(
                    constant.name,
                    PhpSymbolKind.Constant,
                    constant.loc,
                    this.analyzer.scope,
                    [],
                    undefined,
                    constant.value
                )
            );
        }
        return false;
    }
}

