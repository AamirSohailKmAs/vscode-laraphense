'use strict';

import { UseGroup } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { DefinitionKind } from '../../../../helpers/symbol';
import { createReference, normalizeName } from '../../../../helpers/analyze';

export class UseGroupVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: UseGroup): boolean {
        return false;
    }

    visitReference(node: UseGroup): boolean {
        node.items.forEach((use) => {
            let type = DefinitionKind.Namespace;

            if (use.type === 'function') {
                type = DefinitionKind.Function;
            } else if (use.type === 'const') {
                type = DefinitionKind.Constant;
            }

            // fixme: name is a string we need loc
            this.analyzer.addReference(
                createReference(use.name, type, use.loc, use.name, normalizeName(use.alias || '').name),
                true // isImportStatement
            );
        });
        return false;
    }
}

