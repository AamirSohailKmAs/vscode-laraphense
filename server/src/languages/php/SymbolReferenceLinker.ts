'use strict';

import { Definition, FQN, joinNamespace, splitNamespace } from '../../helpers/symbol';
import { RelativeUri } from '../../support/workspaceFolder';
import { Database } from './indexing/Database';
import { ReferenceTable, PhpReference } from './indexing/tables/referenceTable';
import { PhpSymbol, SymbolTable } from './indexing/tables/symbolTable';
import { NamespaceResolver } from './namespaceResolver';

function generateDefinitionKey(definition: Definition) {
    return `${definition.kind}-${definition.scope}-${definition.name}`;
}
export class SymbolReferenceLinker {
    private _uri: RelativeUri = '' as RelativeUri;
    private symbolMap: Map<string, PhpSymbol> = new Map();
    private importMap: Map<string, PhpReference> = new Map();
    private referenceMap: Map<string, PhpReference> = new Map();

    constructor(
        private symbolTable: SymbolTable<PhpSymbol>,
        private referenceTable: ReferenceTable<PhpReference>,
        private resolver: NamespaceResolver,
        private stubsDb?: Database
    ) {}

    public setUri(uri: RelativeUri) {
        this._uri = uri;
        this.resolver.clearImports();

        this.symbolTable.findSymbolsByUri(uri).forEach((symbol) => {
            this.symbolMap.set(generateDefinitionKey(symbol), symbol);
        });
        this.referenceTable.findImportsByUri(uri).forEach((ref) => {
            this.resolver.addImport(ref);
            this.importMap.set(generateDefinitionKey(ref), ref);
        });
        this.referenceTable.findNonImportsByUri(uri).forEach((ref) => {
            this.referenceMap.set(generateDefinitionKey(ref), ref);
        });
    }

    public finalize() {
        this.symbolMap.forEach((symbol) => {
            this.symbolTable.delete(symbol.id);
        });
        this.symbolMap.clear();

        this.importMap.forEach((imp) => {
            this.referenceTable.delete(imp.id);
        });
        this.importMap.clear();

        this.referenceMap.forEach((ref) => {
            this.referenceTable.delete(ref.id);
        });
        this.referenceMap.clear();
    }

    public addSymbol(newSymbol: PhpSymbol, linkToReference: boolean) {
        newSymbol.uri = this._uri;
        let key = generateDefinitionKey(newSymbol);

        const symbol = this.symbolMap.get(key);
        this.symbolMap.delete(key);

        if (!symbol) {
            this.symbolTable.add(newSymbol);
        } else {
            symbol.loc = newSymbol.loc;

            symbol.doc = newSymbol.doc;
            symbol.throws = newSymbol.throws;

            symbol.modifiers = newSymbol.modifiers;
            symbol.relatedIds = newSymbol.relatedIds; // @review is it good
            symbol.type = newSymbol.type;
            symbol.value = newSymbol.value;
        }

        if (!linkToReference) {
            return;
        }

        this.linkSymbol(symbol || newSymbol);
    }

    public addReference(newReference: PhpReference, isImport: boolean = false) {
        newReference.uri = this._uri;

        if (isImport) {
            return this.handleImport(newReference);
        }

        newReference.scope = this.resolver.resolveFromImport(newReference);

        let key = generateDefinitionKey(newReference);
        const reference = this.referenceMap.get(key);
        this.referenceMap.delete(key);

        if (reference) {
            reference.loc = newReference.loc;
            reference.type = newReference.type;
            reference.alias = newReference.alias;
            return;
        }

        newReference.id = this.referenceTable.generateId();
        // @note try to link first so that it doesn't go to pending
        this.linkReference(newReference);

        this.referenceTable.add(newReference);
    }

    private handleImport(newImport: PhpReference) {
        let key = generateDefinitionKey(newImport);
        const oldImport = this.importMap.get(key);
        this.importMap.delete(key);

        if (oldImport) {
            oldImport.loc = newImport.loc;
            oldImport.type = newImport.type;
            oldImport.alias = newImport.alias;
            return;
        }

        newImport.id = this.referenceTable.generateId();
        // @note try to link first so that it doesn't go to pending
        this.linkReference(newImport);

        this.resolver.addImport(newImport);
        this.referenceTable.addImport(newImport);
    }

    private linkReference(reference: PhpReference) {
        const result = this.findSymbolByFqn(splitNamespace(reference.scope));

        if (!result) return false;

        reference.symbolId = result.symbol.id;
        reference.isGlobal = result.isGlobal;
        result.symbol.referenceIds.add(reference.id);
        return true;
    }

    private findSymbolByFqn(fqn: FQN): { symbol: PhpSymbol; isGlobal: boolean } | undefined {
        if (this.stubsDb) {
            let symbol = this.stubsDb.symbolTable.findSymbolByFqn(fqn);
            if (symbol) return { symbol, isGlobal: true };
        }

        let symbol = this.symbolTable.findSymbolByFqn(fqn);
        if (symbol) return { symbol, isGlobal: false };

        return undefined;
    }

    private linkSymbol(symbol: PhpSymbol) {
        const references = this.referenceTable.findPendingByFqn(joinNamespace(symbol.scope, symbol.name));

        references.forEach((reference) => {
            reference.symbolId = symbol.id;
            symbol.referenceIds.add(reference.id);
        });
    }
}

