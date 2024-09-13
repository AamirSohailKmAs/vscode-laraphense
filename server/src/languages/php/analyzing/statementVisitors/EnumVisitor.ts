'use strict';

import { Enum } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';
import { createReference, createSymbol } from '../../../../helpers/analyze';

export class EnumVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: Enum): boolean {
        const scope = this.analyzer.resetMember();
        this.analyzer.setMember(createSymbol(node.name, PhpSymbolKind.Enum, node.loc, scope, [], node.valueType));
        return true;
    }

    visitReference(node: Enum): boolean {
        // todo: Attribute, type
        if (node.implements) {
            node.implements.forEach((interfaceNode) => {
                this.analyzer.addReference(
                    createReference(interfaceNode.name, PhpSymbolKind.Interface, interfaceNode.loc)
                );
            });
        }
        return true;
    }
}

