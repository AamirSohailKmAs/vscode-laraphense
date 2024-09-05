'use strict';

import { ClassConstant } from 'php-parser';
import { SymbolExtractor, NodeVisitor } from '../../analyzer';
import { createSymbol, modifier } from '../../../../helpers/analyze';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';

export class ClassConstantVisitor implements NodeVisitor {
    constructor(private analyzer: SymbolExtractor) {}

    public visit(node: ClassConstant): boolean {
        //todo: Attribute
        for (const constant of node.constants) {
            this.analyzer.addSymbol(
                createSymbol(
                    constant.name,
                    PhpSymbolKind.ClassConstant,
                    constant.loc,
                    this.analyzer.scope,
                    modifier({ isFinal: node.final, visibility: node.visibility }),
                    undefined,
                    constant.value
                )
            );
        }
        return false;
    }
}

