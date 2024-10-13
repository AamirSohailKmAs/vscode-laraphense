'use strict';

import { TraitAlias, TraitPrecedence, TraitUse } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { DefinitionKind } from '../../../../helpers/symbol';
import { createReference } from '../../../../helpers/analyze';

/**
 * @link https://www.php.net/manual/en/language.oop5.traits.php
 */
export class TraitUseVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    public visitSymbol(node: TraitUse): boolean {
        return false;
    }

    visitReference(node: TraitUse): boolean {
        node.traits.forEach((trait) => {
            // todo: alias, resolution
            //fixme: name is string we need loc
            this.analyzer.addReference(createReference(trait.name, DefinitionKind.Trait, trait.loc));
        });

        if (node.adaptations) {
            node.adaptations.forEach((adopt) => {
                this.adaptations()[adopt.kind]?.(adopt);
            });
        }
        return false;
    }

    private adaptations(): Record<string, (node: any) => void> {
        return {
            traitprecedence: (node: TraitPrecedence): void => {
                if (node.trait) {
                    this.analyzer.addReference(createReference(node.trait, DefinitionKind.Trait, node.trait.loc));
                }
                this.analyzer.addReference(createReference(node.method, DefinitionKind.Method, node.loc));

                node.instead.forEach((instead) => {
                    this.analyzer.addReference(createReference(instead, DefinitionKind.Trait, instead.loc));
                });
            },
            traitalias: (node: TraitAlias): void => {
                if (node.trait) {
                    this.analyzer.addReference(createReference(node.trait, DefinitionKind.Trait, node.trait.loc));
                }
                this.analyzer.addReference(createReference(node.method, DefinitionKind.Method, node.loc));
            },
        };
    }
}

