'use strict';

import { ExpressionStatement } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { ExpressionVisitor } from '../expressionVisitors/ExpressionVisitor';

export class ExpressionStatementVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer, private expVisitor: ExpressionVisitor) {}

    visitSymbol(node: ExpressionStatement): boolean {
        return false;
    }

    visitReference(node: ExpressionStatement): boolean {
        this.expVisitor.visit(node.expression);
        return false;
    }
}

