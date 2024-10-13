'use strict';

import { RelativeUri } from '../../../../support/workspaceFolder';
import { Trie } from '../../../../support/searchTree';
import { FQN, Definition, Value } from '../../../../helpers/symbol';
import { Position } from 'vscode-languageserver-textdocument';
import { PhpType } from '../../../../helpers/type';
import { DefinitionKind } from '../../../../helpers/symbol';

interface CacheData<T extends Definition> {
    index: number;
    symbols: [number, T][];
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

export type Template = {
    name: string;
    type?: PhpType;
};

export type PhpSymbolType = {
    declared?: PhpType;
    documented?: PhpType;
    inferred?: PhpType;

    templates?: Template[];
};

export type PhpSymbol = Definition & {
    value?: Value;
    modifiers: SymbolModifier[];

    type: PhpSymbolType;
    doc: {
        summary?: string;
        description?: string;
    };

    throws: Set<string>;
    relatedIds: Set<number>;
    referenceIds: Set<number>;
};
export class SymbolTable<T extends Definition> {
    private index: number = 0;
    private trie: Trie = new Trie();
    private symbols: Map<number, T> = new Map();
    private symbolsByUri: Map<string, number[]> = new Map();
    private symbolsByScope: Map<string, number[]> = new Map();

    constructor(private transformer: (symbol: any) => T) {}

    public add(symbol: T) {
        if (!this.isIdValidate(symbol)) return;

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

    public delete(index: number) {
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

    public getSymbolById(symbolId: number) {
        return this.symbols.get(symbolId);
    }

    public getSymbolsById(symbolIds: number[]) {
        return symbolIds.map((index) => this.symbols.get(index)!).filter((symbol) => symbol);
    }

    public findSymbolByNamePrefix(prefix: string): T[] {
        const indices = this.trie.search(prefix);
        return indices.map((index) => this.symbols.get(index)!).filter((symbol) => symbol);
    }

    public findSymbolByFqn({ scope, name }: FQN) {
        return this.findSymbolByScopeName(scope, name);
    }

    public findSymbolByScopeName(scope: string, name: string) {
        return this.findSymbolsByScope(scope).find((symbol) => symbol.name === name);
    }

    public findSymbolByPositionOffsetInUri(uri: RelativeUri, pos: Position, offset: number): T | undefined {
        let closestSymbol: T | undefined;
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

    public findSymbolsByUri(uri: RelativeUri): T[] {
        const indices = this.symbolsByUri.get(uri) || [];
        return indices.map((index) => this.symbols.get(index)!).filter((symbol) => symbol);
    }

    public findSymbolsByScope(scope: string): T[] {
        const indices = this.symbolsByScope.get(scope) || [];
        return indices.map((index) => this.symbols.get(index)!).filter((symbol) => symbol);
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

    public saveForFile(): CacheData<T> {
        return {
            index: this.index,
            symbols: Array.from(this.symbols.entries()),
            uriIndex: Object.fromEntries(this.symbolsByUri),
            scopeIndex: Object.fromEntries(this.symbolsByScope),
        };
    }

    public loadFromFile(data: any): boolean {
        if (!this.validateCacheData(data)) {
            return false;
        }
        this.index = data.index;
        this.symbols = new Map(data.symbols.map(([id, symbol]: [number, any]) => [id, this.transformer(symbol)]));
        this.symbolsByUri = new Map(Object.entries(data.uriIndex));
        this.symbolsByScope = new Map(Object.entries(data.scopeIndex));

        // Reconstruct trie
        this.trie = new Trie();
        for (const [index, symbol] of this.symbols) {
            this.trie.insert(symbol.name, index);
        }

        return true;
    }

    public getSymbolNested(name: string, scope: string, kind: DefinitionKind): T | undefined {
        return this.findSymbolsByScope(scope).find((symbol) => symbol.kind === kind && symbol.name === name);
    }

    public getAllSymbols(): T[] {
        return Array.from(this.symbols.values());
    }

    private isIdValidate(symbol: T): boolean {
        if (!symbol.uri || symbol.uri === '') {
            return false;
        }

        if (symbol.id === 0) {
            symbol.id = this.index++;
        }

        return true;
    }

    private validateCacheData(data: CacheData<T>): boolean {
        // Validate the structure and types of CacheData
        if (
            typeof data.index !== 'number' ||
            typeof data.symbols !== 'object' ||
            typeof data.uriIndex !== 'object' ||
            typeof data.scopeIndex !== 'object'
        ) {
            return false;
        }
        if (!Array.isArray(data.symbols) || Array.isArray(data.uriIndex) || Array.isArray(data.scopeIndex)) {
            return false;
        }
        if (
            !data.symbols.every(
                (item: any) =>
                    Array.isArray(item) &&
                    item.length === 2 &&
                    typeof item[0] === 'number' &&
                    typeof item[1] === 'object'
            )
        ) {
            return false;
        }

        if (
            !Object.entries(data.uriIndex).every(
                (item: any) => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string'
            )
        ) {
            return false;
        }

        if (
            !Object.entries(data.scopeIndex).every(
                (item: any) => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string'
            )
        ) {
            return false;
        }
        return true;
    }
}

