'use strict';

import { PropertyStatement } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';
import { modifier } from '../../../../helpers/analyze';
import { toFqcn } from '../../../../helpers/symbol';

export class PropertyVisitor implements NodeVisitor {
    private analyzer: Analyzer;

    constructor(analyzer: Analyzer) {
        this.analyzer = analyzer;
    }

    public visit(node: PropertyStatement): boolean {
        // todo: Attribute

        node.properties.forEach((prop) => {
            // todo: Attribute, type
            this.analyzer.addSymbol(
                this.analyzer.createSymbol(
                    prop.name,
                    SymbolKind.Property,
                    node.loc,
                    modifier({
                        isReadonly: prop.readonly,
                        isStatic: node.isStatic,
                        isNullable: prop.nullable,
                        visibility: node.visibility,
                    }),
                    prop.value,
                    toFqcn(this.analyzer.member?.name || '', this.analyzer.containerName)
                )
            );
        });
        return false;
    }
}

