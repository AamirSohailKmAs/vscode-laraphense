'use strict';

import { Echo } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { ExpressionVisitor } from '../expressionVisitors/ExpressionVisitor';

export class EchoVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer, private exprVisitor: ExpressionVisitor) {}

    visitSymbol(node: Echo): boolean {
        return false;
    }

    visitReference(node: Echo): boolean {
        node.expressions.forEach((exp) => this.exprVisitor.visit(exp));
        return false;
    }
}

