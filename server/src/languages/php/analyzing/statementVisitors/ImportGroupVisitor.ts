'use strict';

import { UseGroup } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';
import { createReference, normalizeName } from '../../../../helpers/analyze';

export class UseGroupVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: UseGroup): boolean {
        return false;
    }

    visitReference(node: UseGroup): boolean {
        node.items.forEach((use) => {
            let type = PhpSymbolKind.Namespace;

            if (use.type === 'function') {
                type = PhpSymbolKind.Function;
            } else if (use.type === 'const') {
                type = PhpSymbolKind.Constant;
            }

            // fixme: name is a string we need loc
            this.analyzer.addImportStatement(
                createReference(use.name, type, use.loc, use.name, normalizeName(use.alias || '').name)
            );
        });
        return false;
    }
}

