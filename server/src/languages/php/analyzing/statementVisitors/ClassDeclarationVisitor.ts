'use strict';

import { Class } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { DefinitionKind } from '../../../../helpers/symbol';
import { attrGroupsVisitor, createReference, createSymbol, modifier } from '../../../../helpers/analyze';

export class ClassVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(classNode: Class): boolean {
        const scope = this.analyzer.resetMember();
        const symbol = createSymbol(
            classNode.name,
            DefinitionKind.Class,
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
        attrGroupsVisitor(classNode.attrGroups, this.analyzer);
        if (classNode.extends) {
            this.analyzer.addReference(createReference(classNode.extends, DefinitionKind.Class, classNode.extends.loc));
        }

        if (classNode.implements) {
            classNode.implements.forEach((interfaceNode) => {
                this.analyzer.addReference(
                    // fixme: name is string we need loc
                    createReference(interfaceNode.name, DefinitionKind.Interface, interfaceNode.loc)
                );
            });
        }
        return true;
    }
}

