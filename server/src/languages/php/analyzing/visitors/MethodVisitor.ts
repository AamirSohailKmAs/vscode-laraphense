'use strict';

import { Method, Parameter } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { createSymbol, modifier, parseFlag } from '../../../../helpers/analyze';
import { PhpSymbol, PhpSymbolKind } from '../../indexing/tables/symbolTable';

export class MethodVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    public visit(node: unknown): boolean {
        const methodNode = node as Method;
        // todo: Attribute, type, byref
        const scope = this.analyzer.resetSubMember();
        const method = createSymbol(
            methodNode.name,
            PhpSymbolKind.Method,
            methodNode.loc,
            scope,
            modifier({
                isAbstract: methodNode.isAbstract,
                isFinal: methodNode.isFinal,
                isStatic: methodNode.isStatic,
                isNullable: methodNode.nullable,
                visibility: methodNode.visibility,
            }),
            methodNode.type,
            undefined
        );
        this.analyzer.setSubMember(method);

        // Visit parameters
        if (methodNode.arguments) {
            //todo: Attribute, type, byref
            methodNode.arguments.forEach((param) => this.visitParameter(param, method));
        }

        return true;
    }

    private visitParameter(param: Parameter, method: PhpSymbol): void {
        const kind =
            method.name === '__construct' && param.flags > 0 ? PhpSymbolKind.Property : PhpSymbolKind.Parameter;

        const modifiers = modifier({
            isReadonly: param.readonly,
            isNullable: param.nullable,
            isVariadic: param.variadic,
            visibility: kind === PhpSymbolKind.Property ? parseFlag(param.flags) : undefined,
        });

        const arg = this.analyzer.addSymbol(
            createSymbol(param.name, kind, param.loc, this.analyzer.scope, modifiers, param.type, param.value)
        );

        method.relatedIds.push(arg.id);

        //todo: Attribute, type, byref
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

