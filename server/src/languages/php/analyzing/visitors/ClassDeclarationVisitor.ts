'use strict';

import { Class } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';
import { createReference, createSymbol, modifier } from '../../../../helpers/analyze';

export class ClassVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(classNode: Class): boolean {
        const scope = this.analyzer.resetMember();
        const symbol = createSymbol(
            classNode.name,
            PhpSymbolKind.Class,
            classNode.loc,
            scope,
            modifier({
                isAbstract: classNode.isAbstract,
                isFinal: classNode.isFinal,
                isReadonly: classNode.isReadonly,
                isAnonymous: classNode.isAnonymous,
            })
        );

        this.analyzer.setMember(symbol);

        return true;
    }

    visitReference(classNode: Class): boolean {
        // todo: Attribute
        if (classNode.extends) {
            this.analyzer.addReference(createReference(classNode.extends, PhpSymbolKind.Class, classNode.extends.loc));
        }

        if (classNode.implements) {
            classNode.implements.forEach((interfaceNode) => {
                this.analyzer.addReference(
                    createReference(interfaceNode.name, PhpSymbolKind.Interface, interfaceNode.loc)
                );
            });
        }
        return true;
    }
}

