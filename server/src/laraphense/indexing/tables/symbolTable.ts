'use strict';

import { Location } from 'php-parser';
import { toFqsen, psr4Path, toFqcn } from '../symbol';
import { RelativePathId } from '../workspaceFolder';

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
    private _symbolMap: Map<Fqcn, PhpSymbol> = new Map();
    private _pathMap: Map<RelativePathId, Set<Fqcn>> = new Map();
    private _aliasMap: Map<Fqcn, Set<PhpSymbol>> = new Map();
    private _childrenMap: Map<Fqcn, Map<Selector, PhpSymbol>> = new Map();

    public addSymbols(symbols: PhpSymbol[], path: RelativePathId) {
        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            symbol.path = path;
            this.addSymbol(symbol);
        }
    }

    public addChildrenSymbols(allSymbols: Map<Fqcn, PhpSymbol[]>) {
        for (const [key, symbols] of allSymbols) {
            if (!this._symbolMap.has(key)) {
                // fixme: check _aliasMap
                console.log(`check _aliasMap ${key}`);
                continue;
            }
            const children = this._childrenMap.get(key) ?? new Map<Selector, PhpSymbol>();
            for (let i = 0, l = symbols.length; i < l; i++) {
                const symbol = symbols[i];
                if (!children.has(symbol.name as Selector)) children.set(symbol.name as Selector, symbol);
            }
        }
    }

    private setAlias(symbol: PhpSymbol) {
        const key = toFqcn(symbol.name, symbol.containerName);

        let symbols = this._aliasMap.get(key) || new Set();

        this._aliasMap.set(key, symbols.add(symbol));
    }

    private addFileKeysMap(path: RelativePathId, key: Fqcn) {
        let keys = this._pathMap.get(path) || new Set();
        this._pathMap.set(path, keys.add(key));
    }

    public addSymbol(symbol: PhpSymbol) {
        let key = toFqcn(symbol.name, symbol.containerName);
        const oldSymbol = this._symbolMap.get(key);

        if (!oldSymbol) {
            this.addFileKeysMap(symbol.path, key);
            this._symbolMap.set(key, symbol);
            return;
        }

        if (oldSymbol.kind === symbol.kind && oldSymbol.path === symbol.path) {
            return;
        }

        this.setAlias(symbol);

        // const paths = [oldSymbol.path, symbol.path];

        // const finalPath = psr4Path(key, paths);

        // console.log(finalPath);

        // if (finalPath === oldSymbol.path) {
        //     this.setAlias(symbol);
        //     return;
        // }

        // this._symbolsMap.delete(toFqcn(oldSymbol.name, oldSymbol.containerName));
        // this.setAlias(symbol);
    }

    public getSymbolNested(fullyQualifiedStructuralElementName: Fqsen): PhpSymbol | undefined {
        fullyQualifiedStructuralElementName.split(':');
        return undefined;
        // return this._symbolsMap.get(fullyQualifiedStructuralElementName);
    }

    private getSymbolByKey(key: Fqcn): PhpSymbol | undefined {
        return this._symbolMap.get(key);
    }

    public findSymbolsByFilePath(uri: RelativePathId) {
        const symbols: { symbol: PhpSymbol; children?: Map<Selector, PhpSymbol> }[] = [];
        let symbol: PhpSymbol | undefined;

        const keys = this._pathMap.get(uri);

        if (!keys) return symbols;

        const keyArray = Array.from(keys);

        for (let i = 0; i < keyArray.length; i++) {
            const key = keyArray[i];
            if ((symbol = this.getSymbolByKey(key))) {
                symbols.push({ symbol, children: this._childrenMap.get(key) });
            }
        }

        return symbols;
    }

    public getAllSymbols(): PhpSymbol[] {
        return Array.from(this._symbolMap.values());
    }
}

