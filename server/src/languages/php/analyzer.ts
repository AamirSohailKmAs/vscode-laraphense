'use strict';

import { Tree } from '../../parsers/bladeParser/bladeAst';

import { Block, Namespace, Program } from 'php-parser';
import { PhpSymbol, PhpSymbolKind, SymbolTable } from './indexing/tables/symbolTable';
import { ImportStatement, PhpReference, ReferenceTable } from './indexing/tables/referenceTable';
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
import { joinNamespace } from '../../helpers/symbol';
import { IfVisitor } from './analyzing/visitors/IfVisitor';
import { ForVisitor } from './analyzing/visitors/ForVisitor';
import { ForeachVisitor } from './analyzing/visitors/ForeachVisitor';
import { ReturnVisitor } from './analyzing/visitors/ReturnVisitor';
import { EnumCaseVisitor } from './analyzing/visitors/EnumCaseVisitor';
import { WhileVisitor } from './analyzing/visitors/WhileVisitor';
import { SwitchVisitor } from './analyzing/visitors/SwitchVisitor';
import { UnsetVisitor } from './analyzing/visitors/UnsetVisitor';
import { EchoVisitor } from './analyzing/visitors/EchoVisitor';
import { ConstantStatementVisitor } from './analyzing/visitors/ConstantStatementVisitor';
import { createSymbol } from '../../helpers/analyze';

export type TreeLike = {
    kind: string;
    children?: Array<any>;
    body?: Array<any> | Block;
};

export interface NodeVisitor {
    visit(node: TreeLike): boolean;
}

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
        // when parsing blade file we may get program, so fix scope
        this.analyzer.resetScope();
        return true;
    }
}

export class NamespaceVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(node: Namespace): boolean {
        // todo: add namespace symbol for rename provider
        // todo: we need loc of namespace name instead of given loc
        this.analyzer.setScope(createSymbol(node.name, PhpSymbolKind.Namespace, node.loc, ''));
        return true;
    }
}

export class BlockVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(_node: Block): boolean {
        return true;
    }
}

export class Analyzer {
    private namespace: string = '';
    private member?: PhpSymbol = undefined;
    private subMember?: PhpSymbol = undefined;

    private symbols: PhpSymbol[] = [];
    private references: PhpReference[] = [];
    private uri: RelativeUri = '' as RelativeUri;
    private importStatements: ImportStatement[] = [];
    private visitorMap: Record<string, NodeVisitor>;

    private pendingReferences: Map<string, PhpReference[]> = new Map();
    public stateStack: string[] = [];

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

            block: new BlockVisitor(this),

            // define("FOO",     "something"); todo:
            constantstatement: new ConstantStatementVisitor(this),
            enumcase: new EnumCaseVisitor(this), // todo:

            if: new IfVisitor(this), // todo:
            for: new ForVisitor(this), // todo:
            foreach: new ForeachVisitor(this), // todo:
            while: new WhileVisitor(this), // todo:
            switch: new SwitchVisitor(this), // todo:
            unset: new UnsetVisitor(this), // todo:
            echo: new EchoVisitor(this), // todo:

            // throw: new ThrowVisitor(this),
            // try: new TryVisitor(this),
            // expressionstatement: new ExpressionStatementVisitor(this),
            // variableDeclaration: new VariableDeclarationVisitor(this),

            // callExpression: new visitCallVisitor(this),
            // binaryExpression: new visitBinaryVisitor(this),
            // memberExpression: new visitMemberVisitor(this),

            // 'expressionstatement',
            // 'constantstatement',

            return: new ReturnVisitor(this), // todo:
            // Add other visitors here
        };
    }

    public get scope(): string {
        const namespace = joinNamespace(this.namespace, this.member?.name || '');
        if (!this.subMember) {
            return namespace;
        }

        return namespace + ':' + this.subMember.name;
    }

    public setScope(symbol: PhpSymbol) {
        this.stateStack.push(symbol.name);
        // join if parent child, else set
        this.namespace = symbol.name;
        // this.namespace = this.isParent ? joinNamespace(this.namespace, symbol.name) : symbol.name;
        this.symbols.push(symbol);
        this.resetMember();
    }

    public setMember(symbol: PhpSymbol) {
        this.addSymbol(symbol);
        this.member = symbol;
    }

    public setSubMember(symbol: PhpSymbol) {
        this.addSymbol(symbol);
        this.subMember = symbol;
    }

    public resetMember(): string {
        this.member = undefined;
        this.subMember = undefined;
        return this.scope;
    }

    public resetSubMember(): string {
        this.subMember = undefined;
        return this.scope;
    }

    public resetScope() {
        this.namespace = '';
        this.resetMember();
    }

    public analyse(tree: Tree, uri: RelativeUri) {
        this.uri = uri;

        this.resetState();
        this.traverseAST(tree, this.visitor.bind(this), tree.kind);
        this.resolvePendingReferences();

        return {
            symbols: this.symbols,
            references: this.references,
            importStatements: this.importStatements,
            pendingReferences: this.pendingReferences,
        };
    }

    public resetState() {
        this.symbols = [];
        this.references = [];
        this.importStatements = [];
        this.namespace = '';
        this.member = undefined;
        this.pendingReferences = new Map();
    }

    public addSymbol(symbol: PhpSymbol) {
        symbol.id = this.symbolTable.generateId();
        symbol.uri = this.uri;
        this.symbols.push(symbol);
        this.linkReferencesToSymbol(symbol);

        return symbol;
    }

    public addImportStatement(importStatement: ImportStatement) {
        this.importStatements.push(importStatement);
        importStatement.id = this.referenceTable.generateId();
        importStatement.uri = this.uri;
        this.linkReferenceOrKeep(importStatement);
    }

    public addReference(reference: PhpReference) {
        reference.id = this.referenceTable.generateId();
        reference.uri = this.uri;
        this.references.push(reference);
        this.linkReferenceOrKeep(reference);
    }

    private linkReferenceOrKeep(reference: PhpReference) {
        if (this.linkReference(reference)) {
            return;
        }

        if (!this.pendingReferences.has(reference.name)) {
            this.pendingReferences.set(reference.name, []);
        }
        this.pendingReferences.get(reference.name)!.push(reference);
    }

    private linkReference(reference: PhpReference) {
        const symbol = this.findSymbolForReference(reference);

        if (!symbol) return false;

        reference.symbolId = symbol.id;
        symbol.referenceIds.push(reference.id);
        return true;
    }

    private findSymbolForReference(reference: PhpReference): PhpSymbol | undefined {
        let symbol = this.findSymbolFromImports(reference);
        if (symbol) return symbol;

        if (reference.definedIn.scope === '' && this.namespace) {
            reference.definedIn.scope = this.namespace;
            reference.definedIn.name = reference.name;
        }

        return undefined;
    }

    private findSymbolFromImports(reference: PhpReference) {
        const importStatement = this.importStatements.find(
            (ug) => ug.alias === reference.name || ug.name.endsWith(reference.name)
        );

        if (!importStatement) {
            return undefined;
        }

        reference.fqn = importStatement.fqn;
        const symbol = this.symbolTable.findSymbolByFqn(importStatement.fqn);
        return symbol;
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
                if (this.linkReference(references[i])) {
                    // this.pendingReferences.delete(references[i].name);
                }
            }
        });
    }

    private traverseAST(treeNode: TreeLike, visitor: (treeNode: TreeLike, parent: string) => boolean, parent: string) {
        let shouldDescend = visitor(treeNode, parent);
        let child = treeNode.children ?? treeNode.body;

        if (child && !Array.isArray(child)) {
            child = [child];
        }

        if (child && shouldDescend) {
            // console.log('enter state', treeNode.kind);
            for (let i = 0, l = child.length; i < l; i++) {
                this.traverseAST(child[i], visitor, treeNode.kind);
            }
            if (treeNode.kind === 'namespace') {
                if (this.stateStack.length !== 1) {
                    // console.log(this.uri);
                }

                this.stateStack.pop();
            }
            // console.log('exit state', treeNode.kind);
        }
    }

    private visitor(node: TreeLike, parent: string): boolean {
        const visitor = this.visitorMap[node.kind];
        // return visitor ? visitor.visit(node) : false;

        if (visitor) {
            return visitor.visit(node);
        }

        if (
            ![
                'noop', // ignore for now
                'declare', // ignore for now
                'inline', // ignore for now
                'expressionstatement',
                'element', // ignore for now
                'language', // ignore for now
            ].includes(node.kind)
        ) {
            // console.log(`[${node.kind}] => ${parent}`);
            // console.log(node);
        }

        return false;
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

