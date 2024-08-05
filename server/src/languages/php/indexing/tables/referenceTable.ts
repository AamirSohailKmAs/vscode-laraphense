'use strict';

import { Symbol } from './symbolTable';
import { RelativePath } from '../../../../support/workspaceFolder';
import { Fqsen } from '../analyser';

export type PhpReference = Symbol & {};

export class ReferenceTable {
    private _symbolMap: Map<Fqsen, PhpReference> = new Map();
    private _pathMap: Map<RelativePath, Set<Fqsen>> = new Map();
    private _aliasMap: Map<Fqsen, Set<PhpReference>> = new Map();
    // private _childrenMap: Map<Fqcn, Map<Selector, PhpReference>> = new Map();

    public addReferences(symbols: PhpReference[], path: RelativePath) {
        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            symbol.path = path;
        }
    }

    // public addChildrenSymbols(allSymbols: Map<Fqsen, PhpReference[]>) {
    //     for (const [fqsen, symbols] of allSymbols) {
    //         const { fqcn, selector } = splitFqsen(fqsen);
    //         if (!this._symbolMap.has(fqcn) && !this._aliasMap.has(fqcn)) {
    //             continue;
    //         }
    //         const children = this._childrenMap.get(fqcn) ?? new Map<Selector, PhpReference>();
    //         for (let i = 0, l = symbols.length; i < l; i++) {
    //             const symbol = symbols[i];
    //             if (!children.has(selector)) children.set(selector, symbol);
    //         }
    //         this._childrenMap.set(fqcn, children);
    //     }
    // }

    private addFileKeysMap(path: RelativePath, key: Fqsen) {
        let keys = this._pathMap.get(path) || new Set();
        this._pathMap.set(path, keys.add(key));
    }

    public getSymbolNested(fullyQualifiedStructuralElementName: Fqsen): PhpReference | undefined {
        return this._symbolMap.get(fullyQualifiedStructuralElementName);
    }

    private getSymbolByKey(key: Fqsen): PhpReference | undefined {
        let symbol = this._symbolMap.get(key);
        if (symbol) return symbol;

        const symbols = this._aliasMap.get(key);
        if (!symbols) return undefined;
        for (const symbol of symbols) {
            return symbol;
        }
    }

    public findSymbolsByFilePath(uri: RelativePath) {
        const symbols: PhpReference[] = [];
        let symbol: PhpReference | undefined;

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

    public getAllSymbols(): PhpReference[] {
        return Array.from(this._symbolMap.values());
    }
}

