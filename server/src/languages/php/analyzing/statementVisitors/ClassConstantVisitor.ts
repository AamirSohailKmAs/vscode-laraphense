'use strict';

import { ClassConstant } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { attrGroupsVisitor, createSymbol, modifier } from '../../../../helpers/analyze';
import { DefinitionKind } from '../../../../helpers/symbol';

export class ClassConstantVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    public visitSymbol(node: ClassConstant): boolean {
        for (const constant of node.constants) {
            this.analyzer.addSymbol(
                createSymbol(
                    constant.name,
                    DefinitionKind.ClassConstant,
                    constant.loc,
                    this.analyzer.scope,
                    modifier({ isFinal: node.final, visibility: node.visibility }),
                    undefined,
                    constant.value
                )
            );
        }
        return false;
    }

    visitReference(node: ClassConstant): boolean {
        attrGroupsVisitor(node.attrGroups, this.analyzer);
        return false;
    }
}

