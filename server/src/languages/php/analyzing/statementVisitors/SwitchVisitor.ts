'use strict';

import { Switch } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';

export class SwitchVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: Switch): boolean {
        // this.visitExpression(node.test);

        return false;
    }

    visitReference(node: Switch): boolean {
        return false;
    }
}

