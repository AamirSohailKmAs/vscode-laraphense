'use strict';

import { Trait } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';
import { createSymbol } from '../../../../helpers/analyze';

export class TraitVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(traitNode: Trait): boolean {
        // todo: how to set loc of name
        const symbol = createSymbol(traitNode.name, SymbolKind.Trait, traitNode.loc, this.analyzer.scope);
        // todo: Attribute
        this.analyzer.addSymbol(symbol);

        this.analyzer.member = symbol;
        return true;
    }
}

