'use strict';

import { Switch } from 'php-parser';
import { SymbolExtractor, NodeVisitor } from '../../analyzer';

export class SwitchVisitor implements NodeVisitor {
    constructor(private analyzer: SymbolExtractor) {}

    visit(node: Switch): boolean {
        // this.visitExpression(node.test);

        return false;
    }
}

