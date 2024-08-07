'use strict';

import { Block, Method } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { modifier, normalizeName, parseFlag } from '../../../../helpers/analyze';
import { toFqcn, toFqsen } from '../../../../helpers/symbol';
import { PhpSymbol, SymbolKind } from '../../indexing/tables/symbolTable';

export class MethodVisitor implements NodeVisitor {
    private analyzer: Analyzer;

    constructor(analyzer: Analyzer) {
        this.analyzer = analyzer;
    }

    public visit(methodNode: unknown): boolean {
        const node = methodNode as Method;
        // todo: Attribute, type, byref
        const method = this.analyzer.createSymbol(
            node.name,
            SymbolKind.Method,
            node.loc,
            modifier({
                isAbstract: node.isAbstract,
                isFinal: node.isFinal,
                isStatic: node.isStatic,
                isNullable: node.nullable,
                visibility: node.visibility,
            }),
            undefined,
            toFqcn(this.analyzer.member?.name || '', this.analyzer.containerName)
        );
        this.analyzer.addSymbol(method);

        for (let i = 0; i < node.arguments.length; i++) {
            const param = node.arguments[i];
            //todo: Attribute, type, byref
            if (normalizeName(node.name) === '__construct' && param.flags > 0) {
                this.analyzer.addSymbol(
                    this.analyzer.createSymbol(
                        param.name,
                        SymbolKind.Property,
                        param.loc,
                        modifier({ visibility: parseFlag(param.flags) }),
                        param.value,
                        toFqcn(this.analyzer.member?.name || '', this.analyzer.containerName)
                    )
                );
                continue;
            }

            this.analyzer.addSymbol(
                this.analyzer.createSymbol(
                    param.name,
                    SymbolKind.Parameter,
                    param.loc,
                    modifier({
                        isReadonly: param.readonly,
                        isNullable: param.nullable,
                        isVariadic: param.variadic,
                    }),
                    param.value,
                    toFqsen(method.kind, method.name, method.scope)
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

