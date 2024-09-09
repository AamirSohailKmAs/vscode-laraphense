'use strict';

import { Foreach } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';

export class ForeachVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(forNode: unknown): boolean {
        const node = forNode as Foreach;

        // this.visitExpression(node.source);
        // this.visitExpression(node.key);
        // this.visitExpression(node.value);

        if (node.body) {
            return true;
        }

        return false;
    }
}

