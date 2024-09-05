'use strict';

import { If } from 'php-parser';
import { SymbolExtractor, NodeVisitor } from '../../analyzer';

export class IfVisitor implements NodeVisitor {
    constructor(private analyzer: SymbolExtractor) {}

    visit(node: If): boolean {
        // this.visitExpression(node.test);
        //   if (node.alternate) {
        //       this.visitBlock(node.alternate);
        //   }

        return true;
    }
}

