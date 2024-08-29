'use strict';

import { Echo } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';

export class EchoVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(node: Echo): boolean {
        // node.expressions.forEach((exp) => this.visitExpression(exp));

        return false;
    }
}

