'use strict';

import { Location } from 'php-parser';

export const enum SymbolModifier {
    None,

    Public,
    Protected,
    Private,

    Static,
    StaticPublic,
    StaticProtected,
    StaticPrivate,

    Final,
    Abstract,

    ReadOnly,
    ReadOnlyFinal,
    ReadOnlyAbstract,

    WriteOnly,
    Magic,
    Anonymous,
}

export const enum SymbolKind {
    File,
    Namespace,
    Class,
    Interface,
    Enum,
    Trait,

    Method,
    Property,
    Constructor,

    Function,
    Variable,
    Constant,
    String,
    Number,
    Boolean,
    Array,

    Null,
    EnumMember,
}

export type Symbol = {
    uri: string;
    name: string;
    loc: Location;
    kind: SymbolKind;
    modifier: SymbolModifier;
    children?: Symbol[];
    parent?: Symbol;
};

export class SymbolTable {
    private _symbols: Map<string, Symbol> = new Map();
    private _filesFqn: Map<string, string[]> = new Map();

    public addSymbolsFromMap(symbols: Map<string, Symbol>, uri: string) {
        const fqn: Array<string> = [];

        symbols.forEach((symbol, key) => {
            symbol.uri = uri;
            if (!this._symbols.has(key)) {
                this._symbols.set(key, symbol);
            } else {
                this._symbols.set((key = `1::${key}`), symbol);
                console.log(`key [${key}] already exists [${this._symbols.get(key)?.uri}], current uri is ${uri}`);
            }
            fqn.push(key);
        });

        this._filesFqn.set(uri, fqn);
    }

    /**
     *
     * @param key fully qualified Name
     */
    getSymbolByKey(key: string): Symbol | undefined {
        return this._symbols.get(key);
    }

    findSymbolsByFilePath(uri: string): Symbol[] {
        const symbols: Symbol[] = [];
        let symbol: Symbol | undefined;
        for (const fqn in this._filesFqn.get(uri)) {
            if ((symbol = this._symbols.get(fqn))) {
                symbols.push(symbol);
            }
        }
        return symbols;
    }

    findSymbolByNameAndType(name: string, type: SymbolKind): Symbol | undefined {
        for (const symbol of this._symbols.values()) {
            if (symbol.name === name && symbol.kind === type) {
                return symbol;
            }
        }
        return undefined;
    }

    getAllSymbols(): Symbol[] {
        return Array.from(this._symbols.values());
    }

}

