'use strict';

import { Interface } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';

export class InterfaceVisitor implements NodeVisitor {
    private analyzer: Analyzer;

    constructor(analyzer: Analyzer) {
        this.analyzer = analyzer;
    }

    visit(interfaceNode: Interface): boolean {
        const symbol = this.analyzer.createSymbol(interfaceNode.name, SymbolKind.Interface, interfaceNode.loc);
        this.analyzer.member = symbol;

        // todo: Attribute
        this.analyzer.addSymbol(symbol);

        if (interfaceNode.extends) {
            interfaceNode.extends.forEach((interfaceNode) => {
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

