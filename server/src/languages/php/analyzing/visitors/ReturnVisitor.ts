'use strict';

import { Return } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';

export class ReturnVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: Return): boolean {
        //   if (node.expr) {
        //       this.visitExpression(node.expr);
        //   }

        return false;
    }

    visitReference(node: Return): boolean {
        return false;
    }
}

