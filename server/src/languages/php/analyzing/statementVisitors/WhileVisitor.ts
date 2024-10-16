'use strict';

import { While } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { ExpressionVisitor } from '../expressionVisitors/ExpressionVisitor';

export class WhileVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer, private exprVisitor: ExpressionVisitor) {}

    visitSymbol(whileNode: unknown): boolean {
        const node = whileNode as While;
        this.exprVisitor.visit(node.test);

        if (node.body) {
            return true;
        }

        return false;
    }

    visitReference(whileNode: unknown): boolean {
        const node = whileNode as While;
        return false;
    }
}

