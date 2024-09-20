'use strict';

import { Function, Parameter } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { PhpSymbol, PhpSymbolKind } from '../../indexing/tables/symbolTable';
import { attrGroupsVisitor, createSymbol, modifier } from '../../../../helpers/analyze';
import { ExpressionVisitor } from '../expressionVisitors/ExpressionVisitor';

export class FunctionVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer, private expr: ExpressionVisitor) {}

    visitSymbol(fnNode: unknown): boolean {
        const node = fnNode as Function;

        const scope = this.analyzer.resetMember();
        const func = createSymbol(node.name, PhpSymbolKind.Function, node.loc, scope, modifier(), node.type);
        this.analyzer.setMember(func);

        if (node.arguments) {
            node.arguments.forEach((param) => this.visitParameter(param, func));
        }

        return true;
    }

    visitReference(fnNode: unknown): boolean {
        // todo: type
        const node = fnNode as Function;
        attrGroupsVisitor(node.attrGroups, this.analyzer);
        // this.expr.visit(node.type);
        return false;
    }

    private visitParameter(param: Parameter, func: PhpSymbol): void {
        attrGroupsVisitor(param.attrGroups, this.analyzer);

        const modifiers = modifier({
            isNullable: param.nullable,
            isVariadic: param.variadic,
        });

        const arg = this.analyzer.addSymbol(
            createSymbol(
                param.name,
                PhpSymbolKind.Parameter,
                param.loc,
                this.analyzer.scope,
                modifiers,
                param.type,
                param.value
            )
        );

        func.relatedIds.add(arg.id);

        //todo: type
        // Handle any default values or type hints as references
        if (param.value) {
            // console.log(param.value);
            // this.visitExpression(param.value);
        }
        if (param.type) {
            // console.log(param.type);
            // this.analyzer.addReference(createReference(param.type, param.loc));
        }
    }
}

