'use strict';

import { Expression } from 'php-parser';
import { Analyzer, TreeLike } from '../../analyzer';

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
        'assign',
        'assignref',
        'bin',
        'call',
        'eval',
        'exit',
        'include',
        'isset',
        'match',
        'new',
        'post',
        'pre',
        'print',
        'propertylookup',
        'retif',
        'silent',
        'string',
        'variable',
        'yield',
        'yieldfrom',
    ];
    constructor(private analyzer: Analyzer) {
        this._visitorMap = {
            // 'variable': new VariableVisitor(this.analyzer),
            // 'scalar_declaration': new ScalarDeclarationVisitor(this.analyzer),
            // 'new': new NewVisitor(this.analyzer),
            // 'call': new CallVisitor(this.analyzer),
            // 'array_creation': new ArrayCreationVisitor(this.analyzer),
            // 'assignment': new AssignmentVisitor(this.analyzer),
            // 'static_call': new StaticCallVisitor(this.analyzer),
            // 'method_call': new MethodCallVisitor(this.analyzer),
            // 'class_constant_access': new ClassConstantAccessVisitor(this.analyzer),
            // 'property_access': new PropertyAccessVisitor(this.analyzer),
        };
    }

    public visit(expr: Expression) {
        if (!this.ignoreNodes.includes(expr.kind)) {
            console.log(expr.kind);
            // console.log(expr.kind, this.analyzer.scope);
        }
        return this._visitorMap[expr.kind]?.visit(expr) ?? false;
    }
}

