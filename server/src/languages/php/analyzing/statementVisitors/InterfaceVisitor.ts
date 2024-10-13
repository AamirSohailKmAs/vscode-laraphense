'use strict';

import { Interface } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { DefinitionKind } from '../../../../helpers/symbol';
import { attrGroupsVisitor, createReference, createSymbol } from '../../../../helpers/analyze';

export class InterfaceVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(interfaceNode: Interface): boolean {
        const scope = this.analyzer.resetMember();
        this.analyzer.setMember(createSymbol(interfaceNode.name, DefinitionKind.Interface, interfaceNode.loc, scope));

        return true;
    }

    visitReference(interfaceNode: Interface): boolean {
        attrGroupsVisitor(interfaceNode.attrGroups, this.analyzer);
        if (interfaceNode.extends) {
            interfaceNode.extends.forEach((interfaceNode) => {
                this.analyzer.addReference(
                    // fixme: name is string we need loc
                    createReference(interfaceNode.name, DefinitionKind.Interface, interfaceNode.loc)
                );
            });
        }
        return true;
    }
}

