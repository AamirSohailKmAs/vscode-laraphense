'use strict';

import { Throw } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';

export class ThrowVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: Throw): boolean {
        switch (node.what.kind) {
            case 'new':
                break;
            case 'call':
                break;

            default:
                console.log(node);
                break;
        }

        return false;
    }

    visitReference(node: Throw): boolean {
        return false;
    }
}

