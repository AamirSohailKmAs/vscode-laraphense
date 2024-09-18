'use strict';

import { Interface } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';
import { attrGroupsVisitor, createReference, createSymbol } from '../../../../helpers/analyze';

export class InterfaceVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(interfaceNode: Interface): boolean {
        const scope = this.analyzer.resetMember();
        this.analyzer.setMember(createSymbol(interfaceNode.name, PhpSymbolKind.Interface, interfaceNode.loc, scope));

        return true;
    }

    visitReference(interfaceNode: Interface): boolean {
        attrGroupsVisitor(interfaceNode.attrGroups, this.analyzer);
        if (interfaceNode.extends) {
            interfaceNode.extends.forEach((interfaceNode) => {
                this.analyzer.addReference(
                    createReference(interfaceNode.name, PhpSymbolKind.Interface, interfaceNode.loc)
                );
            });
        }
        return true;
    }
}

