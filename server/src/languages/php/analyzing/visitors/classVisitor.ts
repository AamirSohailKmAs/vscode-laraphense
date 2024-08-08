'use strict';

import { Class } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';
import { createReference, createSymbol, modifier } from '../../../../helpers/analyze';

export class ClassVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(classNode: Class): boolean {
        const symbol = createSymbol(
            classNode.name,
            SymbolKind.Class,
            classNode.loc,
            this.analyzer.scope,
            modifier({
                isAbstract: classNode.isAbstract,
                isFinal: classNode.isFinal,
                isReadonly: classNode.isReadonly,
                isAnonymous: classNode.isAnonymous,
            })
        );
        // todo: Attribute
        this.analyzer.addSymbol(symbol);
        this.analyzer.member = symbol;

        if (classNode.extends) {
            this.analyzer.addReference(createReference(classNode.extends, SymbolKind.Class, classNode.extends.loc));
        }

        if (classNode.implements) {
            classNode.implements.forEach((interfaceNode) => {
                // fixme: resolution, uqn,qf, rn
                this.analyzer.addReference(
                    createReference(interfaceNode.name, SymbolKind.Interface, interfaceNode.loc)
                );
            });
        }

        return true;
    }
}

