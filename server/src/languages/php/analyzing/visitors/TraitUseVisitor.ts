'use strict';

import { TraitAlias, TraitPrecedence, TraitUse } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { SymbolKind } from '../../indexing/tables/symbolTable';

export class TraitUseVisitor implements NodeVisitor {
    private analyzer: Analyzer;

    constructor(analyzer: Analyzer) {
        this.analyzer = analyzer;
    }

    /**
     * @link https://www.php.net/manual/en/language.oop5.traits.php
     */
    public visit(node: TraitUse): boolean {
        node.traits.forEach((trait) => {
            // todo: alias, resolution
            const reference = this.analyzer.createReference(trait.name, SymbolKind.Trait, trait.loc);
            this.analyzer.addReference(reference);
        });

        const adaptationsMap: Record<string, (node: any) => void> = {
            traitprecedence: (node: TraitPrecedence): void => {
                if (node.trait) {
                    const reference = this.analyzer.createReference(node.trait, SymbolKind.Trait, node.trait.loc);
                    this.analyzer.addReference(reference);
                }
                const reference = this.analyzer.createReference(node.method, SymbolKind.Method, node.loc);
                this.analyzer.addReference(reference);

                node.instead.forEach((instead) => {
                    const reference = this.analyzer.createReference(instead, SymbolKind.Trait, instead.loc);
                    this.analyzer.addReference(reference);
                });
            },
            traitalias: (node: TraitAlias): void => {
                if (node.trait) {
                    const reference = this.analyzer.createReference(node.trait, SymbolKind.Trait, node.trait.loc);
                    this.analyzer.addReference(reference);
                }
                const reference = this.analyzer.createReference(node.method, SymbolKind.Method, node.loc);
                this.analyzer.addReference(reference);
            },
        };
        if (node.adaptations) {
            node.adaptations.forEach((adopt) => {
                adaptationsMap[adopt.kind]?.(adopt);
            });
        }
        return false;
    }
}

