'use strict';

import { UseGroup } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';
import { createImportStatement, normalizeName } from '../../../../helpers/analyze';
import { splitNamespace } from '../../../../helpers/symbol';

export class UseGroupVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(node: UseGroup): boolean {
        if (node.items) {
            node.items.forEach((use) => {
                let type = SymbolKind.Class;

                if (use.type === 'function') {
                    type = SymbolKind.Function;
                } else if (use.type === 'const') {
                    type = SymbolKind.Constant;
                }

                this.analyzer.addImportStatement(
                    createImportStatement(
                        use.name,
                        normalizeName(use.alias ?? '').name,
                        type,
                        use.loc,
                        splitNamespace(use.name)
                    )
                );
            });
        }

        return false;
    }
}

