'use strict';

import { Tree } from '../../bladeParser/bladeAst';

import { Identifier, Location, Namespace, Node, Program } from 'php-parser';
import { PhpSymbol, SymbolKind, SymbolModifier, SymbolTable } from './indexing/tables/symbolTable';
import { PhpReference, ReferenceTable } from './indexing/tables/referenceTable';
import { RelativeUri } from '../../support/workspaceFolder';
import { FunctionVisitor } from './analyzing/visitors/FunctionVisitor';
import { InterfaceVisitor } from './analyzing/visitors/InterfaceVisitor';
import { UseGroupVisitor } from './analyzing/visitors/UseGroupVisitor';
import { ClassVisitor } from './analyzing/visitors/ClassVisitor';
import { TraitVisitor } from './analyzing/visitors/TraitVisitor';
import { EnumVisitor } from './analyzing/visitors/EnumVisitor';
import { TraitUseVisitor } from './analyzing/visitors/TraitUseVisitor';
import { PropertyVisitor } from './analyzing/visitors/PropertyVisitor';
import { ClassConstantVisitor } from './analyzing/visitors/ClassConstantVisitor';
import { MethodVisitor } from './analyzing/visitors/MethodVisitor';
import { joinNamespace, splitNamespace } from '../../helpers/symbol';

export type TreeLike = {
    kind: string;
    children?: Array<any>;
    body?: Array<any>;
};

export interface NodeVisitor {
    visit(node: TreeLike): boolean;
}

type UseGroupInfo = {
    fqn: string;
    type: string;
    alias?: string;
};

export class TreeVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(_node: Tree): boolean {
        this.analyzer.resetState();
        return true;
    }
}

export class ProgramVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(_node: Program): boolean {
        this.analyzer.member = undefined;
        return true;
    }
}

export class NamespaceVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(node: Namespace): boolean {
        this.analyzer.scope = node.withBrackets ? joinNamespace(this.analyzer.scope, node.name) : node.name;
        this.analyzer.member = undefined;
        // todo: add namespace symbol for rename provider
        // todo: we need loc of namespace name instead of given loc
        // this.analyzer.addSymbol(this.analyzer.createSymbol(node.name, SymbolKind.Namespace, node.loc));
        return true;
    }
}

export class Analyzer {
    public scope: string = '';
    public member?: PhpSymbol = undefined;

    private symbols: PhpSymbol[] = [];
    private useGroups: UseGroupInfo[] = [];
    private references: PhpReference[] = [];
    private uri: RelativeUri = '' as RelativeUri;
    private visitorMap: Record<string, NodeVisitor>;

    private pendingReferences: Map<string, PhpReference[]> = new Map();

    constructor(private symbolTable: SymbolTable, private referenceTable: ReferenceTable) {
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
        this.resolvePendingReferences();

        return { symbols: this.symbols, references: this.references, pendingReferences: this.pendingReferences };
    }

    public resetState() {
        this.symbols = [];
        this.references = [];
        this.useGroups = [];
        this.scope = '';
        this.member = undefined;
        this.pendingReferences = new Map();
    }

    public addUseGroup(useGroup: UseGroupInfo) {
        this.useGroups.push(useGroup);
    }

    public addSymbol(symbol: PhpSymbol) {
        symbol.id = this.symbolTable.generateId();
        symbol.uri = this.uri;
        this.symbols.push(symbol);
        this.linkReferencesToSymbol(symbol);

        return symbol;
    }

    public addReference(reference: PhpReference) {
        reference.id = this.referenceTable.generateId();
        reference.uri = this.uri;
        this.references.push(reference);
        this.resolveReferenceOrKeep(reference);
    }

    private resolveReferenceOrKeep(reference: PhpReference) {
        if (this.resolveReference(reference)) {
            return;
        }

        if (!this.pendingReferences.has(reference.name)) {
            this.pendingReferences.set(reference.name, []);
        }
        this.pendingReferences.get(reference.name)!.push(reference);
    }

    private resolveReference(reference: PhpReference) {
        const symbol = this.findSymbolForReference(reference);

        if (!symbol) return false;

        reference.symbolId = symbol.id;
        symbol.referenceIds.push(reference.id);
        return true;
    }

    private findSymbolForReference(reference: PhpReference): PhpSymbol | undefined {
        // Utilize useGroups to resolve FQN for references
        const useGroup = this.useGroups.find((ug) => ug.alias === reference.name || ug.fqn.endsWith(reference.name));

        if (useGroup) {
            const fqn = useGroup.alias ? useGroup.fqn.replace(useGroup.alias, reference.name) : useGroup.fqn;
            // fixme: what if reference can have fqn we'll set it
            const split = splitNamespace(fqn);
            const symbol = this.symbolTable.findSymbolByFqn(split.scope, split.name);
            return symbol;
        }
        // Implement logic to find the corresponding symbol for the given reference
        // based on the current scope, context, and other relevant information
        return this.symbols.find((symbol) => symbol.name === reference.name && symbol.scope === this.scope);
    }

    private linkReferencesToSymbol(symbol: PhpSymbol) {
        const references = this.pendingReferences.get(symbol.name);

        if (references) {
            references.forEach((reference) => {
                reference.symbolId = symbol.id;
                symbol.referenceIds.push(reference.id);
            });
            this.pendingReferences.delete(symbol.name);
        }
    }

    public resolvePendingReferences() {
        this.pendingReferences.forEach((references, name) => {
            for (let i = 0; i < references.length; i++) {
                this.resolveReference(references[i]);
                // this.pendingReferences.delete(symbol.name);
            }
        });
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

