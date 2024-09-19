'use strict';

import { Return } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { ExpressionVisitor } from '../expressionVisitors/ExpressionVisitor';

export class ReturnVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer, private exprVisitor: ExpressionVisitor) {}

    visitSymbol(node: Return): boolean {
        if (node.expr) {
            this.exprVisitor.visit(node.expr);
        }

        return false;
    }

    visitReference(node: Return): boolean {
        return false;
    }
}

