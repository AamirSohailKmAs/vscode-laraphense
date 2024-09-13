'use strict';

import { Echo } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';

export class EchoVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: Echo): boolean {
        // node.expressions.forEach((exp) => this.visitExpression(exp));

        return false;
    }

    visitReference(node: Echo): boolean {
        return false;
    }
}

