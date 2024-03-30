'use strict';

import { Location } from 'php-parser';
import { toFqcn, splitFqsen, toFqsen, psr4Path } from '../symbol';
import { RelativePathId } from '../../../../laraphense/workspaceFolder';

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

export const enum SymbolKind {
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

type Symbol = {
    name: string;
    kind: SymbolKind;
    loc: Location;
    path: RelativePathId; // not in use
};

export type PhpSymbol = Symbol & {
    value?: string;
    modifiers: SymbolModifier[];
    containerName?: string;
};

/**
 * a tagging type which is fully Qualified Class Name
 */
export type Fqcn = string & { readonly Fqcn: unique symbol };

/**
 * a tagging type which is Structural Element Selector
 */
export type Selector = string & { readonly Selector: unique symbol };
/**
 * a tagging type which is fully Qualified Structural Element Name
 */
export type Fqsen = string & { readonly Fqsen: unique symbol };

export class SymbolTable {
    private _symbolMap: Map<Fqsen, PhpSymbol> = new Map();
    private _pathMap: Map<RelativePathId, Set<Fqsen>> = new Map();
    private _aliasMap: Map<Fqsen, Set<PhpSymbol>> = new Map();
    // private _childrenMap: Map<Fqcn, Map<Selector, PhpSymbol>> = new Map();

    public addSymbols(symbols: PhpSymbol[], path: RelativePathId) {
        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            symbol.path = path;
            this.addSymbol(symbol);
        }
    }

    // public addChildrenSymbols(allSymbols: Map<Fqsen, PhpSymbol[]>) {
    //     for (const [fqsen, symbols] of allSymbols) {
    //         const { fqcn, selector } = splitFqsen(fqsen);
    //         if (!this._symbolMap.has(fqcn) && !this._aliasMap.has(fqcn)) {
    //             continue;
    //         }
    //         const children = this._childrenMap.get(fqcn) ?? new Map<Selector, PhpSymbol>();
    //         for (let i = 0, l = symbols.length; i < l; i++) {
    //             const symbol = symbols[i];
    //             if (!children.has(selector)) children.set(selector, symbol);
    //         }
    //         this._childrenMap.set(fqcn, children);
    //     }
    // }

    private setAlias(symbol: PhpSymbol) {
        const key = toFqsen(symbol.kind, symbol.name, symbol.containerName);

        let symbols = this._aliasMap.get(key) || new Set();

        this._aliasMap.set(key, symbols.add(symbol));
    }

    private addFileKeysMap(path: RelativePathId, key: Fqsen) {
        let keys = this._pathMap.get(path) || new Set();
        this._pathMap.set(path, keys.add(key));
    }

    public addSymbol(symbol: PhpSymbol) {
        let key = toFqsen(symbol.kind, symbol.name, symbol.containerName);
        const oldSymbol = this._symbolMap.get(key);

        if (!oldSymbol) {
            this.addFileKeysMap(symbol.path, key);
            this._symbolMap.set(key, symbol);
            return;
        }

        if (oldSymbol.path === symbol.path) {
            return;
        }

        const paths = [oldSymbol.path, symbol.path];

        const finalPath = psr4Path(key, paths);

        if (finalPath === oldSymbol.path) {
            this.setAlias(symbol);
            return;
        }

        if (this._symbolMap.delete(toFqsen(oldSymbol.kind, oldSymbol.name, oldSymbol.containerName))) {
            this.setAlias(symbol);
        }
    }

    public getSymbolNested(fullyQualifiedStructuralElementName: Fqsen): PhpSymbol | undefined {
        return this._symbolMap.get(fullyQualifiedStructuralElementName);
    }

    private getSymbolByKey(key: Fqsen): PhpSymbol | undefined {
        let symbol = this._symbolMap.get(key);
        if (symbol) return symbol;

        const symbols = this._aliasMap.get(key);
        if (!symbols) return undefined;
        for (const symbol of symbols) {
            return symbol;
        }
    }

    public findSymbolsByFilePath(uri: RelativePathId) {
        const symbols: PhpSymbol[] = [];
        let symbol: PhpSymbol | undefined;

        const keys = this._pathMap.get(uri);

        if (!keys) return symbols;

        const keyArray = Array.from(keys);

        for (let i = 0; i < keyArray.length; i++) {
            const key = keyArray[i];
            if ((symbol = this.getSymbolByKey(key))) {
                symbols.push(symbol);
            }
        }

        return symbols;
    }

    public getAllSymbols(): PhpSymbol[] {
        return Array.from(this._symbolMap.values());
    }
}

