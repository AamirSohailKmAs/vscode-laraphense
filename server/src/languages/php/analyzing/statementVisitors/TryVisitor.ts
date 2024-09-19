'use strict';

import { Try } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';

export class TryVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: Try): boolean {
        return false; // @fixme cases must be unique
    }

    visitReference(node: Try): boolean {
        return false;
    }
}

