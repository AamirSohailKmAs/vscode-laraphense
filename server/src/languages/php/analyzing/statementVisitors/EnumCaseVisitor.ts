'use strict';

import { EnumCase } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { createSymbol } from '../../../../helpers/analyze';
import { DefinitionKind } from '../../../../helpers/symbol';

export class EnumCaseVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: EnumCase): boolean {
        this.analyzer.addSymbol(
            createSymbol(node.name, DefinitionKind.EnumMember, node.loc, this.analyzer.scope, [], undefined, node.value)
        );

        return false;
    }

    visitReference(node: EnumCase): boolean {
        return false;
    }
}

