'use strict';

import { Enum } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';

export class EnumVisitor implements NodeVisitor {
    private analyzer: Analyzer;

    constructor(analyzer: Analyzer) {
        this.analyzer = analyzer;
    }

    visit(node: Enum): boolean {
        const symbol = this.analyzer.createSymbol(node.name, SymbolKind.Enum, node.loc);
        this.analyzer.member = symbol;
        // todo: Attribute, type
        this.analyzer.addSymbol(symbol);

        if (node.implements) {
            node.implements.forEach((interfaceNode) => {
                // fixme: resolution, uqn,qf, rn
                const reference = this.analyzer.createReference(
                    interfaceNode.name,
                    SymbolKind.Interface,
                    interfaceNode.loc
                );
                this.analyzer.addReference(reference);
            });
        }
        return true;
    }
}

