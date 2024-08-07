'use strict';

import { UseGroup } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';

export class UseGroupVisitor implements NodeVisitor {
    private analyzer: Analyzer;

    constructor(analyzer: Analyzer) {
        this.analyzer = analyzer;
    }

    visit(node: UseGroup): boolean {
        if (node.items) {
            node.items.forEach((use) => {
                // todo: type, alias
                const reference = this.analyzer.createReference(use.name, SymbolKind.Class, use.loc);
                this.analyzer.addReference(reference);
            });
        }

        return false;
    }
}

