'use strict';

import { Throw } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { ExpressionVisitor } from '../expressionVisitors/ExpressionVisitor';

export class ThrowVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer, private expr: ExpressionVisitor) {}

    visitSymbol(node: Throw): boolean {
        // switch (node.what.kind) {
        //     case 'new':
        //         break;
        //     case 'call':
        //         break;
        //     case 'variable':
        //         break;
        //     case 'retif':
        //         break;
        //     case 'bin':
        //         break;
        //     case 'propertylookup':
        //         break;

        //     default:
        //         console.log(node);
        //         break;
        // }

        return false;
    }

    visitReference(node: Throw): boolean {
        return false;
    }
}

