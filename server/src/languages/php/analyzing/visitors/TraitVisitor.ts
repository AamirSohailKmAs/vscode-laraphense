'use strict';

import { Trait } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';
import { createSymbol } from '../../../../helpers/analyze';

export class TraitVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(traitNode: Trait): boolean {
        // todo: how to set loc of name
        const scope = this.analyzer.resetMember();
        // todo: Attribute
        this.analyzer.setMember(createSymbol(traitNode.name, PhpSymbolKind.Trait, traitNode.loc, scope));
        return true;
    }

    visitReference(traitNode: Trait): boolean {
        return false;
    }
}

