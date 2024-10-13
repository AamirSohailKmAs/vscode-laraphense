'use strict';

import { Enum } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { DefinitionKind } from '../../../../helpers/symbol';
import { attrGroupsVisitor, createReference, createSymbol } from '../../../../helpers/analyze';

export class EnumVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: Enum): boolean {
        const scope = this.analyzer.resetMember();
        this.analyzer.setMember(createSymbol(node.name, DefinitionKind.Enum, node.loc, scope, [], node.valueType));
        return true;
    }

    visitReference(node: Enum): boolean {
        attrGroupsVisitor(node.attrGroups, this.analyzer);
        if (node.implements) {
            node.implements.forEach((interfaceNode) => {
                this.analyzer.addReference(
                    // fixme: name is string we need loc
                    createReference(interfaceNode.name, DefinitionKind.Interface, interfaceNode.loc)
                );
            });
        }
        return true;
    }
}

