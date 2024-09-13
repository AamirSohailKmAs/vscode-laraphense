'use strict';

import { Unset } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';

export class UnsetVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: Unset): boolean {
        return false;
    }

    visitReference(node: Unset): boolean {
        return false;
    }
}

