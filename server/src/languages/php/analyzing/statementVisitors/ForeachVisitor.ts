'use strict';

import { Foreach } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { ExpressionVisitor } from '../expressionVisitors/ExpressionVisitor';

export class ForeachVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer, private exprVisitor: ExpressionVisitor) {}

    visitSymbol(forNode: unknown): boolean {
        const node = forNode as Foreach;

        this.exprVisitor.visit(node.source);
        if (node.key) {
            this.exprVisitor.visit(node.key);
        }
        this.exprVisitor.visit(node.value);

        if (node.body) {
            return true;
        }
        return false;
    }

    visitReference(foreachNode: unknown): boolean {
        const node = foreachNode as Foreach;
        return false;
    }
}

