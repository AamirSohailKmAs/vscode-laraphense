'use strict';

import { ExpressionStatement } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';

export class ExpressionStatementVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: ExpressionStatement): boolean {
        this.analyzer.debug.set(node.expression.kind, node.expression);

        return false;
    }

    visitReference(node: ExpressionStatement): boolean {
        return false;
    }
}

