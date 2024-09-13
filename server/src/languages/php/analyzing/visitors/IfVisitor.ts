'use strict';

import { If } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';

export class IfVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: If): boolean {
        return true;
        // this.visitExpression(node.test);
        //   if (node.alternate) {
        //       this.visitBlock(node.alternate);
        //   }
    }

    visitReference(node: If): boolean {
        return false;
    }
}

