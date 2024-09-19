'use strict';

import { Switch } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { ExpressionVisitor } from '../expressionVisitors/ExpressionVisitor';

export class SwitchVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer, private exprVisitor: ExpressionVisitor) {}

    visitSymbol(node: Switch): boolean {
        this.exprVisitor.visit(node.test);

        return false; // @fixme cases must be unique
    }

    visitReference(node: Switch): boolean {
        return false;
    }
}

