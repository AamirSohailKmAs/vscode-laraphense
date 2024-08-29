'use strict';

import { Trait } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';
import { createSymbol } from '../../../../helpers/analyze';

export class TraitVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(traitNode: Trait): boolean {
        // todo: how to set loc of name
        const scope = this.analyzer.resetMember();
        // todo: Attribute
        this.analyzer.setMember(createSymbol(traitNode.name, SymbolKind.Trait, traitNode.loc, scope));
        return true;
    }
}

