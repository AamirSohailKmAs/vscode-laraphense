'use strict';

import { ConstantStatement } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { createSymbol } from '../../../../helpers/analyze';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';

export class ConstantStatementVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: ConstantStatement): boolean {
        node.constants.forEach((constant) => {
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
        });

        return false;
    }

    visitReference(node: ConstantStatement): boolean {
        return false;
    }
}

