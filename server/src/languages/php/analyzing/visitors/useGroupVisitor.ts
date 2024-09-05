'use strict';

import { UseGroup } from 'php-parser';
import { SymbolExtractor, NodeVisitor } from '../../analyzer';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';
import { createImportStatement, normalizeName } from '../../../../helpers/analyze';
import { splitNamespace } from '../../../../helpers/symbol';

export class UseGroupVisitor implements NodeVisitor {
    constructor(private analyzer: SymbolExtractor) {}

    visit(node: UseGroup): boolean {
        if (node.items) {
            node.items.forEach((use) => {
                let type = PhpSymbolKind.Class;

                if (use.type === 'function') {
                    type = PhpSymbolKind.Function;
                } else if (use.type === 'const') {
                    type = PhpSymbolKind.Constant;
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

