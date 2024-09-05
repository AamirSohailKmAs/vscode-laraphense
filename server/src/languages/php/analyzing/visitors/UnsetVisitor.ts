'use strict';

import { Unset } from 'php-parser';
import { SymbolExtractor, NodeVisitor } from '../../analyzer';

export class UnsetVisitor implements NodeVisitor {
    constructor(private analyzer: SymbolExtractor) {}

    visit(node: Unset): boolean {
        return false;
    }
}

