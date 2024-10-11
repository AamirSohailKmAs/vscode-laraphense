'use strict';

import { joinNamespace, splitNamespace } from '../../helpers/symbol';
import { WorkspaceFolder } from '../../support/workspaceFolder';
import { Database } from './indexing/Database';
import { ReferenceTable, PhpReference } from './indexing/tables/referenceTable';
import { PhpSymbol, PhpSymbolKind, SymbolTable } from './indexing/tables/symbolTable';
import { NamespaceResolver } from './namespaceResolver';

export class SymbolReferenceLinker {
    constructor(
        private symbolTable: SymbolTable<PhpSymbolKind, PhpSymbol>,
        private referenceTable: ReferenceTable<PhpSymbolKind, PhpReference>,
        private resolver: NamespaceResolver,
        private stubsDb?: Database
    ) {
        this.resolver.clearImports();
    }

    public addImport(importStatement: PhpReference) {
        this.resolver.addImport(importStatement);
        this.linkReference(importStatement, true);
    }

    public linkReferencesToSymbol(symbol: PhpSymbol) {
        const references = this.referenceTable.findPendingByFqn(joinNamespace(symbol.scope, symbol.name));

        if (references) {
            references.forEach((reference) => {
                reference.symbolId = symbol.id;
                symbol.referenceIds.add(reference.id);
            });
        }
    }

    public linkReference(reference: PhpReference, isImport: boolean = false) {
        const result = this.findSymbolForReference(reference, isImport);

        if (!result) return false;

        reference.symbolId = result.symbol.id;
        reference.isGlobal = result.isGlobal;
        result.symbol.referenceIds.add(reference.id);
        return true;
    }

    private findSymbolForReference(
        reference: PhpReference,
        isImport: boolean = true
    ): { symbol: PhpSymbol; isGlobal: boolean } | undefined {
        if (!isImport) {
            reference.scope = this.resolver.resolveFromImport(reference);
        }

        const fqn = splitNamespace(reference.scope);

        if (this.stubsDb) {
            let symbol = this.stubsDb.symbolTable.findSymbolByFqn(fqn);
            if (symbol) return { symbol, isGlobal: true };
        }

        let symbol = this.symbolTable.findSymbolByFqn(fqn);
        if (symbol) return { symbol, isGlobal: false };

        return undefined;
    }
}

