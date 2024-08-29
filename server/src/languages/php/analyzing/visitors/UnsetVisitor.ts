'use strict';

import { Unset } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';

export class UnsetVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(node: Unset): boolean {
        return false;
    }
}

