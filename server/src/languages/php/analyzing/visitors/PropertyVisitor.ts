'use strict';

import { PropertyStatement } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';
import { createSymbol, modifier } from '../../../../helpers/analyze';

export class PropertyVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    public visit(node: PropertyStatement): boolean {
        // todo: Attribute

        node.properties.forEach((prop) => {
            // todo: Attribute, type
            this.analyzer.addSymbol(
                createSymbol(
                    prop.name,
                    SymbolKind.Property,
                    node.loc,
                    this.analyzer.scope,
                    modifier({
                        isReadonly: prop.readonly,
                        isStatic: node.isStatic,
                        isNullable: prop.nullable,
                        visibility: node.visibility,
                    }),
                    prop.value
                )
            );
        });
        return false;
    }
}

