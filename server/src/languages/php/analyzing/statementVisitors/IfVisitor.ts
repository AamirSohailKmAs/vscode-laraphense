'use strict';

import { If } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { ExpressionVisitor } from '../expressionVisitors/ExpressionVisitor';

export class IfVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer, private exprVisitor: ExpressionVisitor) {}

    visitSymbol(node: If): boolean {
        this.exprVisitor.visit(node.test);
        if (node.alternate) {
            // this.exprVisitor.visit(node.alternate);
        }
        return true;
    }

    visitReference(node: If): boolean {
        return false;
    }
}

