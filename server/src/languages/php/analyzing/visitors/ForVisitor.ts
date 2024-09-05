'use strict';

import { For } from 'php-parser';
import { SymbolExtractor, NodeVisitor } from '../../analyzer';

export class ForVisitor implements NodeVisitor {
    constructor(private analyzer: SymbolExtractor) {}

    visit(forNode: unknown): boolean {
        const node = forNode as For;

        // node.init.forEach((init) => this.visitExpression(init));
        // node.test.forEach((test) => this.visitExpression(test));
        // node.increment.forEach((increment) => this.visitExpression(increment));

        if (node.body) {
            return true;
        }

        return false;
    }
}

