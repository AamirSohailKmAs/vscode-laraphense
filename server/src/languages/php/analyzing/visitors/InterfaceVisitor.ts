'use strict';

import { Interface } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';
import { createReference, createSymbol } from '../../../../helpers/analyze';

export class InterfaceVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(interfaceNode: Interface): boolean {
        // todo: Attribute
        const symbol = this.analyzer.addSymbol(
            createSymbol(interfaceNode.name, SymbolKind.Interface, interfaceNode.loc, this.analyzer.scope)
        );
        this.analyzer.member = symbol;

        if (interfaceNode.extends) {
            interfaceNode.extends.forEach((interfaceNode) => {
                // fixme: resolution, uqn,qf, rn
                this.analyzer.addReference(
                    createReference(interfaceNode.name, SymbolKind.Interface, interfaceNode.loc)
                );
            });
        }
        return true;
    }
}

