'use strict';

import { Trait } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';

export class TraitVisitor implements NodeVisitor {
    private analyzer: Analyzer;

    constructor(analyzer: Analyzer) {
        this.analyzer = analyzer;
    }

    visit(traitNode: Trait): boolean {
        const symbol = this.analyzer.createSymbol(traitNode.name, SymbolKind.Trait, traitNode.loc);
        this.analyzer.member = symbol;
        // todo: Attribute
        this.analyzer.addSymbol(symbol);
        return true;
    }
}

