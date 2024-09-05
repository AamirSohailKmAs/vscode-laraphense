'use strict';

import { Return } from 'php-parser';
import { SymbolExtractor, NodeVisitor } from '../../analyzer';

export class ReturnVisitor implements NodeVisitor {
    constructor(private analyzer: SymbolExtractor) {}

    visit(node: Return): boolean {
        //   if (node.expr) {
        //       this.visitExpression(node.expr);
        //   }

        return false;
    }
}

