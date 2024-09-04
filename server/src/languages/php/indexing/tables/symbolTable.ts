'use strict';

import { RelativeUri } from '../../../../support/workspaceFolder';
import { Trie } from '../../../../support/searchTree';
import { FQN, Symbol, Value } from '../../../../helpers/symbol';
import { Position } from 'vscode-languageserver-textdocument';
import { PhpType } from '../../../../helpers/type';

interface CacheData {
    symbols: [number, PhpSymbol][];
    uriIndex: { [uri: string]: number[] };
    scopeIndex: { [scope: string]: number[] };
}

export const enum SymbolModifier {
    Public,
    Protected,
    Private,

    Static,
    Final,
    Abstract,
    ReadOnly,

    Magic,
    Anonymous,
    Nullable,
    Variadic,
}

export const enum PhpSymbolKind {
    File,
    Namespace,
    Enum,
    Trait,
    Class,
    Interface,
    Method,
    Property,
    PromotedProperty,
    EnumMember,
    Constructor,
    ClassConstant,
    Function,
    Variable,
    Parameter,
    Array,
    Null,
    String,
    Number,
    Boolean,
    Constant,
}

export type PhpSymbolType = {
    declared?: PhpType;
    documented?: PhpType;
    inferred?: PhpType;
};

export type PhpSymbol = Symbol & {
    kind: PhpSymbolKind;
    // namePosition: number;
    value?: Value;
    modifiers: SymbolModifier[];
    scope: string;

    type: PhpSymbolType;

    throws: string[];
    relatedIds: number[];
    referenceIds: number[];
};
export class SymbolTable {
    private index: number = 0;
    private trie: Trie = new Trie();
    private symbols: Map<number, PhpSymbol> = new Map();
    private symbolsByUri: Map<string, number[]> = new Map();
    private symbolsByScope: Map<string, number[]> = new Map();

    public generateId(): number {
        return this.index++;
    }

    public addSymbols(symbols: PhpSymbol[]) {
        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            this.addSymbol(symbol);
        }
    }

    public addSymbol(symbol: PhpSymbol) {
        if (symbol.uri === '') {
            return;
        }
        if (symbol.id === 0) {
            symbol.id = this.generateId();
        }

        if (this.symbols.has(symbol.id)) {
            console.log(symbol, ' already exists');

            return;
        }

        // let key = toFqsen(symbol.kind, symbol.name, symbol.scope);
        // const oldSymbol = this._symbolMap.get(key);

        const index = symbol.id;
        this.symbols.set(index, symbol);

        if (!this.symbolsByUri.has(symbol.uri)) {
            this.symbolsByUri.set(symbol.uri, []);
        }
        this.symbolsByUri.get(symbol.uri)!.push(index); // todo: validate uniqueness

        if (!this.symbolsByScope.has(symbol.scope)) {
            this.symbolsByScope.set(symbol.scope, []);
        }
        this.symbolsByScope.get(symbol.scope)!.push(index); // todo: validate uniqueness

        this.trie.insert(symbol.name, index);
    }

    public getSymbolById(symbolId: number) {
        return this.symbols.get(symbolId);
    }

    public getSymbolsById(symbolIds: number[]) {
        return symbolIds.map((index) => this.symbols.get(index)!).filter((symbol) => symbol);
    }

    public findSymbolByNamePrefix(prefix: string): PhpSymbol[] {
        const indices = this.trie.search(prefix);
        return indices.map((index) => this.symbols.get(index)!).filter((symbol) => symbol);
    }

    public findSymbolByFqn({ scope, name }: FQN) {
        return this.findSymbolByScopeName(scope, name);
    }

    public findSymbolByScopeName(scope: string, name: string) {
        return this.findSymbolsByScope(scope).find((symbol) => symbol.name === name);
    }

    public findSymbolByPositionOffsetInUri(uri: RelativeUri, pos: Position, offset: number): PhpSymbol | undefined {
        let closestSymbol: PhpSymbol | undefined;
        let closestDistance = Number.MAX_VALUE;

        for (const symbol of this.findSymbolsByUri(uri)) {
            const distance = Math.min(
                Math.abs(symbol.loc.start.offset - offset),
                Math.abs(symbol.loc.end.offset - offset)
            );

            if (
                distance < closestDistance &&
                symbol.loc.start.offset <= offset &&
                symbol.loc.end.offset >= offset &&
                [symbol.loc.start.line, symbol.loc.end.line].includes(pos.line + 1)
            ) {
                closestSymbol = symbol;
                closestDistance = distance;
            }
        }

        return closestSymbol;
    }

    public findSymbolsByUri(uri: RelativeUri): PhpSymbol[] {
        const indices = this.symbolsByUri.get(uri) || [];
        return indices.map((index) => this.symbols.get(index)!).filter((symbol) => symbol);
    }

    public findSymbolsByScope(scope: string): PhpSymbol[] {
        const indices = this.symbolsByScope.get(scope) || [];
        return indices.map((index) => this.symbols.get(index)!).filter((symbol) => symbol);
    }

    public updateSymbol(index: number, newSymbol: PhpSymbol) {
        const oldSymbol = this.symbols.get(index);
        if (oldSymbol) {
            this.symbols.set(index, newSymbol);

            // Update Trie
            this.trie.remove(oldSymbol.name, index);
            this.trie.insert(newSymbol.name, index);

            // Update URI index
            const uriIndices = this.symbolsByUri.get(oldSymbol.uri)!;
            const uriIndexPos = uriIndices.indexOf(index);
            if (uriIndexPos > -1) {
                uriIndices[uriIndexPos] = index;
            }

            // Update scope index
            const scopeIndices = this.symbolsByScope.get(oldSymbol.scope)!;
            const scopeIndexPos = scopeIndices.indexOf(index);
            if (scopeIndexPos > -1) {
                scopeIndices[scopeIndexPos] = index;
            }
        }
    }

    public deleteSymbol(index: number) {
        const symbol = this.symbols.get(index);
        if (symbol) {
            this.symbols.delete(index);

            // Update Trie
            this.trie.remove(symbol.name, index);

            // Update URI index
            const uriIndices = this.symbolsByUri.get(symbol.uri)!;
            const uriIndexPos = uriIndices.indexOf(index);
            if (uriIndexPos > -1) {
                uriIndices.splice(uriIndexPos, 1);
            }

            // Update scope index
            const scopeIndices = this.symbolsByScope.get(symbol.scope)!;
            const scopeIndexPos = scopeIndices.indexOf(index);
            if (scopeIndexPos > -1) {
                scopeIndices.splice(scopeIndexPos, 1);
            }
        }
    }

    public deleteSymbolsByUri(uri: string) {
        const indices = this.symbolsByUri.get(uri) || [];
        for (const index of indices) {
            const symbol = this.symbols.get(index);
            if (symbol) {
                this.symbols.delete(index);

                // Update Trie
                this.trie.remove(symbol.name, index);

                // Update scope index
                const scopeIndices = this.symbolsByScope.get(symbol.scope)!;
                const scopeIndexPos = scopeIndices.indexOf(index);
                if (scopeIndexPos > -1) {
                    scopeIndices.splice(scopeIndexPos, 1);
                }
            }
        }

        this.symbolsByUri.delete(uri);
    }

    public saveForFile(): CacheData {
        return {
            symbols: Array.from(this.symbols.entries()),
            uriIndex: Object.fromEntries(this.symbolsByUri),
            scopeIndex: Object.fromEntries(this.symbolsByScope),
        };
    }

    public loadFromFile(cacheFileContent: string) {
        const data: CacheData = JSON.parse(cacheFileContent); // todo:
        this.symbols = new Map(data.symbols);
        this.symbolsByUri = new Map(Object.entries(data.uriIndex));
        this.symbolsByScope = new Map(Object.entries(data.scopeIndex));

        // Reconstruct trie
        this.trie = new Trie();
        for (const [index, symbol] of this.symbols) {
            this.trie.insert(symbol.name, index);
        }
    }

    public getSymbolNested(name: string, scope: string, kind: PhpSymbolKind): PhpSymbol | undefined {
        return this.findSymbolsByScope(scope).find((symbol) => symbol.kind === kind && symbol.name === name);
    }

    public getAllSymbols(): PhpSymbol[] {
        return Array.from(this.symbols.values());
    }
}

