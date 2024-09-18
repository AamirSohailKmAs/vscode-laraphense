'use strict';

import { PropertyStatement } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';
import { attrGroupsVisitor, createSymbol, modifier } from '../../../../helpers/analyze';

export class PropertyVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    public visitSymbol(node: PropertyStatement): boolean {
        node.properties.forEach((prop) => {
            this.analyzer.addSymbol(
                createSymbol(
                    prop.name,
                    PhpSymbolKind.Property,
                    node.loc,
                    this.analyzer.scope,
                    modifier({
                        isReadonly: prop.readonly,
                        isStatic: node.isStatic,
                        isNullable: prop.nullable,
                        visibility: node.visibility,
                    }),
                    prop.type,
                    prop.value
                )
            );
        });
        return false;
    }

    visitReference(node: PropertyStatement): boolean {
        node.properties.forEach((prop) => {
            attrGroupsVisitor(prop.attrGroups, this.analyzer);
            // todo: type
        });
        return false;
    }
}

