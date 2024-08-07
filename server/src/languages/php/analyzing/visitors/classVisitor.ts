'use strict';

import { Class } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';
import { modifier } from '../../../../helpers/analyze';

export class ClassVisitor implements NodeVisitor {
    private analyzer: Analyzer;

    constructor(analyzer: Analyzer) {
        this.analyzer = analyzer;
    }

    visit(classNode: Class): boolean {
        const symbol = this.analyzer.createSymbol(
            classNode.name,
            SymbolKind.Class,
            classNode.loc,
            modifier({
                isAbstract: classNode.isAbstract,
                isFinal: classNode.isFinal,
                isReadonly: classNode.isReadonly,
                isAnonymous: classNode.isAnonymous,
            })
        );
        // todo: Attribute
        this.analyzer.member = symbol;
        this.analyzer.addSymbol(symbol);

        if (classNode.extends) {
            const reference = this.analyzer.createReference(classNode.extends, SymbolKind.Class, classNode.extends.loc);
            this.analyzer.addReference(reference);
        }

        if (classNode.implements) {
            classNode.implements.forEach((interfaceNode) => {
                // fixme: resolution, uqn,qf, rn
                const reference = this.analyzer.createReference(
                    interfaceNode.name,
                    SymbolKind.Interface,
                    interfaceNode.loc
                );
                this.analyzer.addReference(reference);
            });
        }

        return true;
    }
}

