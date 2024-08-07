'use strict';

import { Tree } from '../../bladeParser/bladeAst';

import { Identifier, Location, Namespace, Node, Program } from 'php-parser';
import { PhpSymbol, SymbolKind, SymbolModifier, SymbolTable } from './indexing/tables/symbolTable';
import { PhpReference, ReferenceTable } from './indexing/tables/referenceTable';
import { RelativeUri } from '../../support/workspaceFolder';
import { normalizeName, normalizeValue } from '../../helpers/analyze';
import { FunctionVisitor } from './analyzing/visitors/FunctionVisitor';
import { InterfaceVisitor } from './analyzing/visitors/InterfaceVisitor';
import { UseGroupVisitor } from './analyzing/visitors/useGroupVisitor';
import { ClassVisitor } from './analyzing/visitors/classVisitor';
import { TraitVisitor } from './analyzing/visitors/TraitVisitor';
import { EnumVisitor } from './analyzing/visitors/EnumVisitor';
import { TraitUseVisitor } from './analyzing/visitors/TraitUseVisitor';
import { PropertyVisitor } from './analyzing/visitors/PropertyVisitor';
import { ClassConstantVisitor } from './analyzing/visitors/ClassConstantVisitor';
import { MethodVisitor } from './analyzing/visitors/MethodVisitor';

export type TreeLike = {
    kind: string;
    children?: Array<any>;
    body?: Array<any>;
};

export interface NodeVisitor {
    visit(node: TreeLike): boolean;
}

export class TreeVisitor implements NodeVisitor {
    private analyzer: Analyzer;

    constructor(analyzer: Analyzer) {
        this.analyzer = analyzer;
    }

    visit(_node: Tree): boolean {
        this.analyzer.resetState();
        return true;
    }
}

export class ProgramVisitor implements NodeVisitor {
    private analyzer: Analyzer;

    constructor(analyzer: Analyzer) {
        this.analyzer = analyzer;
    }

    visit(_node: Program): boolean {
        this.analyzer.member = undefined;
        return true;
    }
}

export class NamespaceVisitor implements NodeVisitor {
    private analyzer: Analyzer;

    constructor(analyzer: Analyzer) {
        this.analyzer = analyzer;
    }

    visit(node: Namespace): boolean {
        this.analyzer.containerName = node.name;
        this.analyzer.member = undefined;
        // todo: add namespace symbol for rename provider
        // todo: we need loc of namespace name instead of given loc
        // this.symbols.push(this._newSymbol(node.name, SymbolKind.Namespace, node.loc));
        return true;
    }
}

export class Analyzer {
    private symbols: PhpSymbol[] = [];
    private references: PhpReference[] = [];
    public containerName: string = '';
    private uri: RelativeUri = '' as RelativeUri;
    public member?: PhpSymbol = undefined;

    private symbolTable: SymbolTable;
    private referenceTable: ReferenceTable;

    private unresolvedReferences: Map<string, PhpReference[]> = new Map();
    private visitorMap: Record<string, NodeVisitor>;

    constructor(symbolTable: SymbolTable, referenceTable: ReferenceTable) {
        this.symbolTable = symbolTable;
        this.referenceTable = referenceTable;

        this.visitorMap = {
            tree: new TreeVisitor(this),
            program: new ProgramVisitor(this),
            namespace: new NamespaceVisitor(this),
            usegroup: new UseGroupVisitor(this),
            function: new FunctionVisitor(this),
            class: new ClassVisitor(this),
            interface: new InterfaceVisitor(this),
            trait: new TraitVisitor(this),
            enum: new EnumVisitor(this),

            traituse: new TraitUseVisitor(this),

            propertystatement: new PropertyVisitor(this),
            classconstant: new ClassConstantVisitor(this),
            method: new MethodVisitor(this),
            // Add other visitors here
        };
    }

    public analyse(tree: Tree, uri: RelativeUri) {
        this.uri = uri;

        this.resetState();
        this.traverseAST(tree, this.visitor.bind(this));
        this.resolveUnresolvedReferences();

        return { symbols: this.symbols, references: this.references, unresolvedReferences: this.unresolvedReferences };
    }

    public resetState() {
        this.symbols = [];
        this.references = [];
        this.containerName = '';
        this.member = undefined;
        this.unresolvedReferences = new Map();
    }

    private traverseAST(treeNode: TreeLike, visitor: (treeNode: TreeLike) => boolean) {
        let shouldDescend = visitor(treeNode);
        const child = treeNode.children ?? treeNode.body;

        if (child && shouldDescend) {
            for (let i = 0, l = child.length; i < l; i++) {
                this.traverseAST(child[i], visitor);
            }
        }
    }

    private visitor(node: TreeLike): boolean {
        const visitor = this.visitorMap[node.kind];
        return visitor ? visitor.visit(node) : false;
    }

    public createSymbol(
        name: string | Identifier,
        kind: SymbolKind,
        loc: Location | null | undefined,
        modifiers: SymbolModifier[] = [],
        value?: string | number | boolean | Node | null,
        containerName?: string
    ): PhpSymbol {
        name = normalizeName(name);
        value = normalizeValue(value);
        if (!containerName) {
            containerName = this.containerName;
        }

        if (loc === null || loc === undefined) {
            loc = { source: null, start: { column: 0, line: 0, offset: 0 }, end: { column: 0, line: 0, offset: 0 } };
            console.log(`symbol ${name} of kind ${kind} does not have a location`);
        }

        const symbol: PhpSymbol = {
            id: this.symbolTable.generateId(),
            name,
            kind,
            loc,
            uri: this.uri,
            modifiers: modifiers,
            value,
            scope: containerName,
            referenceIds: [],
        };

        return symbol;
    }

    public addSymbol(symbol: PhpSymbol) {
        this.symbols.push(symbol);
        this.resolveUnresolvedReferencesForSymbol(symbol);
    }

    public createReference(
        name: string | Identifier,
        kind: SymbolKind,
        loc: Location | null | undefined
    ): PhpReference {
        name = normalizeName(name);

        if (loc === null || loc === undefined) {
            loc = { source: null, start: { column: 0, line: 0, offset: 0 }, end: { column: 0, line: 0, offset: 0 } };
            console.log(`symbol ${name} of kind ${kind} does not have a location`);
        }

        const reference: PhpReference = {
            id: this.referenceTable.generateId(),
            symbolId: 0, // Initial value, will be resolved later
            name,
            kind,
            loc,
            uri: this.uri,
            // modifiers: modifiers,
            // value,
            // containerName,
        };

        return reference;
    }

    public addReference(reference: PhpReference) {
        this.references.push(reference);
        this.linkReferenceToSymbol(reference);
    }

    private linkReferenceToSymbol(reference: PhpReference) {
        const symbol = this.findSymbolForReference(reference);
        if (symbol) {
            reference.symbolId = symbol.id;
            symbol.referenceIds.push(reference.id);
        } else {
            if (!this.unresolvedReferences.has(reference.name)) {
                this.unresolvedReferences.set(reference.name, []);
            }
            this.unresolvedReferences.get(reference.name)!.push(reference);
        }
    }

    private resolveUnresolvedReferencesForSymbol(symbol: PhpSymbol) {
        const references = this.unresolvedReferences.get(symbol.name);
        if (references) {
            references.forEach((reference) => {
                reference.symbolId = symbol.id;
                symbol.referenceIds.push(reference.id);
            });
            this.unresolvedReferences.delete(symbol.name);
        }
    }

    private findSymbolForReference(reference: PhpReference): PhpSymbol | undefined {
        // Implement logic to find the corresponding symbol for the given reference
        // based on the current scope, context, and other relevant information
        return this.symbols.find((symbol) => symbol.name === reference.name && symbol.scope === this.containerName);
    }

    private resolveUnresolvedReferences() {
        this.unresolvedReferences.forEach((references, name) => {
            references.forEach((reference) => {
                const symbol = this.findSymbolForReference(reference);
                if (symbol) {
                    reference.symbolId = symbol.id;
                    symbol.referenceIds.push(reference.id);
                }
            });
        });
    }
}

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

