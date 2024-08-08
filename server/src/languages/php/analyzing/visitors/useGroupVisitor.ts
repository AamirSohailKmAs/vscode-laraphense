'use strict';

import { UseGroup } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';
import { createReference, normalizeName } from '../../../../helpers/analyze';

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

                this.analyzer.addReference(createReference(use.name, type, use.loc));

                this.analyzer.addUseGroup({
                    fqn: use.name,
                    type: use.type ?? '', // todo: do we need this?
                    alias: normalizeName(use.alias ?? ''),
                });
            });
        }

        return false;
    }
}

