'use strict';

import { NamespaceResolver } from '../namespaceResolver';
import { PhpReference, ReferenceTable } from './tables/referenceTable';
import { PhpSymbol, PhpSymbolKind, SymbolTable } from './tables/symbolTable';

export class Database {
    public symbolTable: SymbolTable<PhpSymbolKind, PhpSymbol>;
    public referenceTable: ReferenceTable<PhpSymbolKind, PhpReference>;
    public resolver: NamespaceResolver;

    constructor(jsonContent: string) {
        this.symbolTable = new SymbolTable((symbol: any) => {
            return {
                ...symbol,
                throws: new Set(Object.entries(symbol.throws)),
                relatedIds: new Set(Object.entries(symbol.relatedIds)),
                referenceIds: new Set(Object.entries(symbol.referenceIds)),
            };
        });
        this.referenceTable = new ReferenceTable();

        this.resolver = new NamespaceResolver(jsonContent);
    }
}

