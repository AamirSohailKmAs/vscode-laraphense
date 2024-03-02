'use strict';

import {
    Class,
    Enum,
    Function,
    Identifier,
    Interface,
    Location,
    Method,
    Namespace,
    Program,
    PropertyStatement,
    Trait,
} from 'php-parser';
import { Symbol, SymbolKind, SymbolModifier } from './indexing/tables/symbolTable';
import { Tree } from '../types/bladeAst';

type TreeLike = {
    kind: string;
    children?: Array<any>;
    body?: Array<any>;
};

export class Analyser {
    analyse(tree: Tree) {
        const symbols = new SymbolExtractor().extract(tree);

        return { symbols };
    }
}
class SymbolExtractor {
    symbols: Map<string, Symbol> = new Map();
    parent?: Symbol = undefined;
    member?: Symbol = undefined;

    constructor() {}

    extract(tree: Tree) {
        this.traverseAST(tree, this.nodeKind.bind(this));
        return this.symbols;
    }

    reset() {
        this.symbols.clear();
        this.parent = undefined;
        this.member = undefined;
    }

    traverseAST(treeNode: TreeLike, visit: (treeNode: TreeLike) => boolean) {
        let shouldDescend = visit(treeNode);
        const child = treeNode.children ?? treeNode.body;

        if (child && shouldDescend) {
            for (let i = 0, l = child.length; i < l; i++) {
                this.traverseAST(child[i], visit);
            }
        }
    }

    nodeKind(node: TreeLike): boolean {
        return this.dispatchMap[node.kind]?.(node) ?? false;
    }

    _modifier(): SymbolModifier {
        return SymbolModifier.None;
    }

    _createSymbolKey(): string {
        const parentName = this.parent?.name || '';
        const memberName = this.member?.name || '';

        let separator = '';
        if (this.parent) {
            separator = '\\';
        }

        return `${parentName}${separator}${memberName}`;
    }

    _normalizeName(name: string | Identifier) {
        if (typeof name !== 'string') {
            name = name.name;
        }
        return name;
    }

    _createSymbol(
        name: string,
        kind: SymbolKind,
        loc: Location | null,
        modifier: SymbolModifier = SymbolModifier.None,
        parent?: Symbol,
        children?: Symbol[]
    ) {
        if (loc === null) {
            loc = { source: null, start: { column: 0, line: 0, offset: 0 }, end: { column: 0, line: 0, offset: 0 } };
            console.log(`symbol ${name} of kind ${kind} does not have a location`);
        }

        return {
            name,
            kind,
            loc,
            uri: '',
            modifier,
            parent,
            children,
        } satisfies Symbol;
    }

    dispatchMap: Record<string, (node: any) => boolean> = {
        program: (_node: Program): boolean => {
            this.member = undefined;
            return true;
        },
        tree: (_node: Tree): boolean => {
            this.reset();
            return true;
        },
        namespace: (node: Namespace): boolean => {
            this.parent = this._createSymbol(node.name, SymbolKind.Namespace, node.loc);
            return true;
        },
        class: (node: Class): boolean => {
            this.member = this._createSymbol(
                this._normalizeName(node.name),
                SymbolKind.Class,
                node.loc,
                this._modifier(),
                this.parent
            );
            this.symbols.set(this._createSymbolKey(), this.member);
            return true;
        },
        interface: (node: Interface): boolean => {
            this.member = this._createSymbol(
                this._normalizeName(node.name),
                SymbolKind.Interface,
                node.loc,
                SymbolModifier.None,
                this.parent
            );
            this.symbols.set(this._createSymbolKey(), this.member);
            return true;
        },
        trait: (node: Trait): boolean => {
            this.member = this._createSymbol(
                this._normalizeName(node.name),
                SymbolKind.Trait,
                node.loc,
                SymbolModifier.None,
                this.parent
            );
            this.symbols.set(this._createSymbolKey(), this.member);
            return true;
        },
        enum: (node: Enum): boolean => {
            this.member = this._createSymbol(
                this._normalizeName(node.name),
                SymbolKind.Enum,
                node.loc,
                SymbolModifier.None,
                this.parent
            );
            this.symbols.set(this._createSymbolKey(), this.member);
            return true;
        },
        function: (node: Function): boolean => {
            this.member = this._createSymbol(
                this._normalizeName(node.name),
                SymbolKind.Function,
                node.loc,
                SymbolModifier.None,
                this.parent
            );
            this.symbols.set(this._createSymbolKey(), this.member);
            this.member = undefined;
            return true;
        },
        propertystatement: (node: PropertyStatement): boolean => {
            node.properties.forEach((prop) => {
                this.member?.children?.push(
                    this._createSymbol('$' + prop.name, SymbolKind.Property, node.loc, this._modifier())
                );
            });
            return true;
        },
        method: (node: Method): boolean => {
            const method = this._createSymbol(this._normalizeName(node.name), SymbolKind.Method, node.loc);
            this.member?.children?.push(method);
            node.arguments.forEach((param) => {
                method.children?.push(
                    this._createSymbol(
                        '$' + this._normalizeName(param.name),
                        SymbolKind.Variable,
                        param.loc,
                        this._modifier()
                    )
                );
            });
            return true;
        },
    };
}

