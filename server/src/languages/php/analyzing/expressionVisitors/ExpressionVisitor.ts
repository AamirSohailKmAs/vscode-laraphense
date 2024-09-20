'use strict';

import { Expression } from 'php-parser';
import { Analyzer, TreeLike } from '../../analyzer';
import { AssignVisitor } from './AssignVisitor';

export interface ExpressionNodeVisitor {
    /**
     * Method that runs on each node during AST traversal.
     * Used to perform the main processing logic for each stage.
     *
     * @param node The current node in the AST being visited.
     */
    visit(node: TreeLike): boolean;
}

export class ExpressionVisitor implements ExpressionNodeVisitor {
    private _visitorMap: Record<string, ExpressionNodeVisitor>;
    private ignoreNodes = [
        'array',
        'arrowfunc',
        // 'assign',
        'assignref',
        'bin',
        'boolean',
        'call',
        'cast',
        'clone',
        'closure',
        'encapsed',
        'empty',
        'eval',
        'exit',
        'include',
        'isset',
        'list',
        'match',
        'name',
        'new',
        'nowdoc',
        'nullkeyword',
        'number',
        'offsetlookup',
        'post',
        'pre',
        'print',
        'propertylookup',
        'retif',
        'silent',
        'staticlookup',
        'string',
        'typereference',
        'uniontype',
        'unary',
        'variable',
        'yield',
        'yieldfrom',
    ];

    constructor(private analyzer: Analyzer) {
        this._visitorMap = {
            assign: new AssignVisitor(this),
            // 'variable': new VariableVisitor(this.analyzer),
            // 'scalar_declaration': new ScalarDeclarationVisitor(this.analyzer),
            // 'new': new NewVisitor(this.analyzer),
            // 'call': new CallVisitor(this.analyzer),//@note important  // define("FOO",     "something"); todo:
            // 'array_creation': new ArrayCreationVisitor(this.analyzer),
            // 'assignment': new AssignmentVisitor(this.analyzer),
            // 'static_call': new StaticCallVisitor(this.analyzer),
            // 'method_call': new MethodCallVisitor(this.analyzer),
            // 'class_constant_access': new ClassConstantAccessVisitor(this.analyzer),
            // 'property_access': new PropertyAccessVisitor(this.analyzer),
        };
    }

    public visit(expr: Expression) {
        if (!expr) return false;

        const visitor = this._visitorMap[expr.kind];
        if (!visitor) {
            if (!this.ignoreNodes.includes(expr.kind)) {
                console.log(expr.kind);
                // console.log(expr.kind, this.analyzer.scope);
            }
            return false;
        }

        return visitor.visit(expr);
    }
}

