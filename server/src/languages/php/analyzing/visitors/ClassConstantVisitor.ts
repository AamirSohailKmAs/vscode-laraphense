'use strict';

import { ClassConstant } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { createSymbol, modifier } from '../../../../helpers/analyze';
import { SymbolKind } from '../../indexing/tables/symbolTable';

export class ClassConstantVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    public visit(node: ClassConstant): boolean {
        //todo: Attribute
        for (const constant of node.constants) {
            this.analyzer.addSymbol(
                createSymbol(
                    constant.name,
                    SymbolKind.Constant,
                    constant.loc,
                    this.analyzer.scope,
                    modifier({ isFinal: node.final, visibility: node.visibility }),
                    constant.value
                )
            );
        }
        return false;
    }
}

