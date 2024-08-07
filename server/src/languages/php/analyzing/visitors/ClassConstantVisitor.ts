'use strict';

import { ClassConstant } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { modifier } from '../../../../helpers/analyze';
import { toFqcn } from '../../../../helpers/symbol';
import { SymbolKind } from '../../indexing/tables/symbolTable';

export class ClassConstantVisitor implements NodeVisitor {
    private analyzer: Analyzer;

    constructor(analyzer: Analyzer) {
        this.analyzer = analyzer;
    }

    public visit(node: ClassConstant): boolean {
        //todo: Attribute
        for (const constant of node.constants) {
            this.analyzer.addSymbol(
                this.analyzer.createSymbol(
                    constant.name,
                    SymbolKind.Constant,
                    constant.loc,
                    modifier({ isFinal: node.final, visibility: node.visibility }),
                    constant.value,
                    toFqcn(this.analyzer.member?.name || '', this.analyzer.containerName)
                )
            );
        }
        return false;
    }
}

