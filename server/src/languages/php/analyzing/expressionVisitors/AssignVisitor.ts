'use strict';

import { Assign } from 'php-parser';
import { ExpressionNodeVisitor, ExpressionVisitor } from './ExpressionVisitor';

export class AssignVisitor implements ExpressionNodeVisitor {
    private _operatorMap: Map<string, (node: Assign) => void> = new Map();
    constructor(private expr: ExpressionVisitor) {
        this._operatorMap.set('=', visitEqual);
        this._operatorMap.set('.=', (node: Assign) => {});
        this._operatorMap.set('+=', (node: Assign) => {});
        this._operatorMap.set('-=', (node: Assign) => {});
        this._operatorMap.set('*=', (node: Assign) => {});
        this._operatorMap.set('/=', (node: Assign) => {});
        this._operatorMap.set('%=', (node: Assign) => {});
        // this._operatorMap.set('<<=', (node:Assign) => {});
        this._operatorMap.set('>>=', (node: Assign) => {});
        this._operatorMap.set('&=', (node: Assign) => {});
        this._operatorMap.set('^=', (node: Assign) => {});
        this._operatorMap.set('|=', (node: Assign) => {});
        // this._operatorMap.set('=>', (node:Assign) => {});
        this._operatorMap.set('??=', (node: Assign) => {});
        // this._operatorMap.set('**=', (node:Assign) => {});
        // this._operatorMap.set('??', (node:Assign) => {});
        // this._operatorMap.set('=>', (node:Assign) => {});
    }

    visit(node: Assign): boolean {
        const visitor = this._operatorMap.get(node.operator);

        if (!visitor) {
            console.log(node);
            return false;
        }
        visitor(node);
        // this.expr.visit(node.left);
        // this.expr.visit(node.right);

        return false;
    }
}

function visitEqual(node: Assign) {
    // console.log(node.left.kind, node.right.kind);
    // if left is variable then either it is new variable or it is already defined variable like parameter
}

