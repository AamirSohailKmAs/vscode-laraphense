'use strict';

import { Block, Method } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { createSymbol, modifier, normalizeName, parseFlag } from '../../../../helpers/analyze';
import { joinNamespace } from '../../../../helpers/symbol';
import { PhpSymbol, SymbolKind } from '../../indexing/tables/symbolTable';

export class MethodVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    public visit(methodNode: unknown): boolean {
        const node = methodNode as Method;
        // todo: Attribute, type, byref
        const method = createSymbol(
            node.name,
            SymbolKind.Method,
            node.loc,
            joinNamespace(this.analyzer.scope, this.analyzer.member?.name || ''),
            modifier({
                isAbstract: node.isAbstract,
                isFinal: node.isFinal,
                isStatic: node.isStatic,
                isNullable: node.nullable,
                visibility: node.visibility,
            }),
            undefined
        );
        this.analyzer.addSymbol(method);

        for (let i = 0; i < node.arguments.length; i++) {
            const param = node.arguments[i];
            //todo: Attribute, type, byref
            if (normalizeName(node.name) === '__construct' && param.flags > 0) {
                this.analyzer.addSymbol(
                    createSymbol(
                        param.name,
                        SymbolKind.Property,
                        param.loc,
                        joinNamespace(this.analyzer.scope, this.analyzer.member?.name || ''),
                        modifier({ visibility: parseFlag(param.flags) }),
                        param.value
                    )
                );
                continue;
            }

            this.analyzer.addSymbol(
                createSymbol(
                    param.name,
                    SymbolKind.Parameter,
                    param.loc,
                    joinNamespace(method.scope, method.name),
                    modifier({
                        isReadonly: param.readonly,
                        isNullable: param.nullable,
                        isVariadic: param.variadic,
                    }),
                    param.value
                )
            );
        }

        if (node.body) {
            // should go inside and get the symbols and references
            this._analyseInsideMethod(node.body, method);
        }
        return false;
    }

    private _analyseInsideMethod(body: Block, method: PhpSymbol) {
        // body.children.forEach((param) => {
        //     this.addChildrenSymbol(this._newSymbol(param.name, SymbolKind.Variable, param.loc), method);
        // });
    }
}

