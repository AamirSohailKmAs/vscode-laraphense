'use strict';

import { PhpReference, ReferenceTable } from './tables/referenceTable';
import { PhpSymbol, SymbolTable } from './tables/symbolTable';

export class Database {
    constructor(
        public symbolTable: SymbolTable<PhpSymbol>, // @todo make them private
        public referenceTable: ReferenceTable<PhpReference> // @todo make them private
    ) {}
}

