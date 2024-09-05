'use strict';

import { Echo } from 'php-parser';
import { SymbolExtractor, NodeVisitor } from '../../analyzer';

export class EchoVisitor implements NodeVisitor {
    constructor(private analyzer: SymbolExtractor) {}

    visit(node: Echo): boolean {
        // node.expressions.forEach((exp) => this.visitExpression(exp));

        return false;
    }
}

