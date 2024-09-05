'use strict';

import { TraitAlias, TraitPrecedence, TraitUse } from 'php-parser';
import { SymbolExtractor, NodeVisitor } from '../../analyzer';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';
import { createReference } from '../../../../helpers/analyze';

/**
 * @link https://www.php.net/manual/en/language.oop5.traits.php
 */
export class TraitUseVisitor implements NodeVisitor {
    constructor(private analyzer: SymbolExtractor) {}

    public visit(node: TraitUse): boolean {
        node.traits.forEach((trait) => {
            // todo: alias, resolution
            this.analyzer.addReference(createReference(trait.name, PhpSymbolKind.Trait, trait.loc));
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
                    this.analyzer.addReference(createReference(node.trait, PhpSymbolKind.Trait, node.trait.loc));
                }
                this.analyzer.addReference(createReference(node.method, PhpSymbolKind.Method, node.loc));

                node.instead.forEach((instead) => {
                    this.analyzer.addReference(createReference(instead, PhpSymbolKind.Trait, instead.loc));
                });
            },
            traitalias: (node: TraitAlias): void => {
                if (node.trait) {
                    this.analyzer.addReference(createReference(node.trait, PhpSymbolKind.Trait, node.trait.loc));
                }
                this.analyzer.addReference(createReference(node.method, PhpSymbolKind.Method, node.loc));
            },
        };
    }
}

