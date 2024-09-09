'use strict';

import { While } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';

export class WhileVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(whileNode: unknown): boolean {
        const node = whileNode as While;
        // this.visitExpression(node.test);

        if (node.body) {
            return true;
        }

        return false;
    }
}

