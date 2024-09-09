'use strict';

import { Interface } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';
import { createReference, createSymbol } from '../../../../helpers/analyze';

export class InterfaceVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(interfaceNode: Interface): boolean {
        // todo: Attribute
        const scope = this.analyzer.resetMember();
        this.analyzer.setMember(createSymbol(interfaceNode.name, PhpSymbolKind.Interface, interfaceNode.loc, scope));

        if (interfaceNode.extends) {
            interfaceNode.extends.forEach((interfaceNode) => {
                // fixme: resolution, uqn,qf, rn
                this.analyzer.addReference(
                    createReference(interfaceNode.name, PhpSymbolKind.Interface, interfaceNode.loc)
                );
            });
        }
        return true;
    }
}

