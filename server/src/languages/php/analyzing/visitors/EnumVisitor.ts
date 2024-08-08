'use strict';

import { Enum } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';
import { createReference, createSymbol } from '../../../../helpers/analyze';

export class EnumVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(node: Enum): boolean {
        // todo: Attribute, type
        const symbol = this.analyzer.addSymbol(createSymbol(node.name, SymbolKind.Enum, node.loc, this.analyzer.scope));

        this.analyzer.member = symbol;

        if (node.implements) {
            node.implements.forEach((interfaceNode) => {
                // fixme: resolution, uqn,qf, rn
                this.analyzer.addReference(
                    createReference(interfaceNode.name, SymbolKind.Interface, interfaceNode.loc)
                );
            });
        }
        return true;
    }
}

