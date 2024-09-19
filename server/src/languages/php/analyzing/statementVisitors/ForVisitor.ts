'use strict';

import { For } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { ExpressionVisitor } from '../expressionVisitors/ExpressionVisitor';

export class ForVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer, private exprVisitor: ExpressionVisitor) {}

    visitSymbol(forNode: unknown): boolean {
        const node = forNode as For;

        node.init.forEach((init) => this.exprVisitor.visit(init));
        node.test.forEach((test) => this.exprVisitor.visit(test));
        node.increment.forEach((increment) => this.exprVisitor.visit(increment));

        if (node.body) {
            return true;
        }

        return false;
    }

    visitReference(forNode: unknown): boolean {
        const node = forNode as For;
        return false;
    }
}

