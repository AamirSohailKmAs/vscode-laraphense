'use strict';

import { PropertyStatement } from 'php-parser';
import { SymbolExtractor, NodeVisitor } from '../../analyzer';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';
import { createSymbol, modifier } from '../../../../helpers/analyze';

export class PropertyVisitor implements NodeVisitor {
    constructor(private analyzer: SymbolExtractor) {}

    public visit(node: PropertyStatement): boolean {
        // todo: Attribute

        node.properties.forEach((prop) => {
            // todo: Attribute, type
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
}

