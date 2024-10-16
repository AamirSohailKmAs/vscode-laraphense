'use strict';

import { Position } from 'vscode-languageserver';
import { Definition, Value } from '../../helpers/symbol';
import { Trie } from '../../support/searchTree';
import { RelativeUri, WorkspaceFolder } from '../../support/workspaceFolder';
import { Analyzer } from './analyzer';

export class Indexer {
    private analyzer: Analyzer;
    private bladeFiles: Array<RelativeUri> = [];

    private configMap: Map<string, string> = new Map();
    private configFiles: Array<RelativeUri> = [];

    private publicFiles: Array<RelativeUri> = [];
    private symbolTable: SymbolTable = new SymbolTable();

    constructor(private _folder: WorkspaceFolder) {
        this.analyzer = new Analyzer(this.symbolTable);
    }

    public index() {
        // get blade files without running the code
        this.bladeFiles = this.setFiles((file) => file.endsWith('.blade.php'));
        // this._folder.symbolTable.findSymbolByFqn({
        //     scope: 'Illuminate\\View\\Compilers\\BladeCompiler',
        //     name: 'directive',
        // });
        // this._folder.symbolTable.findSymbolByFqn({
        //     scope: 'Illuminate\\Support\\Facades\\Blade',
        //     name: 'directive',
        // });

        // get config path
        this.configFiles = this.setFiles((file) => file.startsWith('config'));
        const envFile = this._folder.fetcher.getFileContent(this._folder.documentUri('.env'));
        if (envFile) {
            this.analyzer.analyzeEnv(envFile, '.env' as RelativeUri);
        }
        const envExampleFile = this._folder.fetcher.getFileContent(this._folder.documentUri('.env.example'));
        if (envExampleFile) {
            this.analyzer.analyzeEnv(envExampleFile, '.env' as RelativeUri);
        }
        // get middlewares without running the code
        // get controllers without running the code
        this.publicFiles = this.setFiles((file) => {
            return file.startsWith('public') && !file.endsWith('.php');
        });
        // get routes without running the code
        // get translations without running the code
        // get view files without running the code
    }

    private setFiles(callable: (uri: RelativeUri) => boolean) {
        const files = this._folder.filesArray.filter(callable);
        // for (let i = 0; i < files.length; i++) {
        //     const file = files[i];
        //     this.symbolTable.addSymbol({
        //         id: this.symbolTable.generateId(),
        //         name: file.uri,
        //         uri: '' as RelativeUri,
        //         loc: file.loc,
        //     });
        // }

        return files.map((file) => file);
    }
}

type LaravelSymbol = Definition & {
    value?: Value;
};

interface CacheData {
    symbols: [number, LaravelSymbol][];
    uriIndex: { [uri: string]: number[] };
}
export class SymbolTable {
    private index: number = 0;
    private trie: Trie = new Trie();
    private symbols: Map<number, LaravelSymbol> = new Map();
    private symbolsByUri: Map<string, number[]> = new Map();

    public generateId(): number {
        return this.index++;
    }

    public addSymbols(symbols: LaravelSymbol[]) {
        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            this.addSymbol(symbol);
        }
    }

    public addSymbol(symbol: LaravelSymbol) {
        // if (symbol.uri === '') {
        //     return;
        // }
        if (symbol.id === 0) {
            symbol.id = this.generateId();
        }

        if (this.symbols.has(symbol.id)) {
            console.log(symbol, ' already exists');

            return;
        }

        const index = symbol.id;
        this.symbols.set(index, symbol);

        if (!this.symbolsByUri.has(symbol.uri)) {
            this.symbolsByUri.set(symbol.uri, []);
        }
        this.symbolsByUri.get(symbol.uri)!.push(index); // todo: validate uniqueness

        this.trie.insert(symbol.name, index);
    }

    public getSymbolById(symbolId: number) {
        return this.symbols.get(symbolId);
    }

    public getSymbolsById(symbolIds: number[]) {
        return symbolIds.map((index) => this.symbols.get(index)!).filter((symbol) => symbol);
    }

    public findSymbolByNamePrefix(prefix: string): LaravelSymbol[] {
        const indices = this.trie.search(prefix);
        return indices.map((index) => this.symbols.get(index)!).filter((symbol) => symbol);
    }

    public findSymbolByPositionOffsetInUri(uri: RelativeUri, pos: Position, offset: number): LaravelSymbol | undefined {
        let closestSymbol: LaravelSymbol | undefined;
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

    public findSymbolsByUri(uri: RelativeUri): LaravelSymbol[] {
        const indices = this.symbolsByUri.get(uri) || [];
        return indices.map((index) => this.symbols.get(index)!).filter((symbol) => symbol);
    }

    public updateSymbol(index: number, newSymbol: LaravelSymbol) {
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
            }
        }

        this.symbolsByUri.delete(uri);
    }

    public saveForFile(): CacheData {
        return {
            symbols: Array.from(this.symbols.entries()),
            uriIndex: Object.fromEntries(this.symbolsByUri),
        };
    }

    public loadFromFile(cacheFileContent: string) {
        const data: CacheData = JSON.parse(cacheFileContent); // todo:
        this.symbols = new Map(data.symbols);
        this.symbolsByUri = new Map(Object.entries(data.uriIndex));

        // Reconstruct trie
        this.trie = new Trie();
        for (const [index, symbol] of this.symbols) {
            this.trie.insert(symbol.name, index);
        }
    }

    public getAllSymbols(): LaravelSymbol[] {
        return Array.from(this.symbols.values());
    }
}

