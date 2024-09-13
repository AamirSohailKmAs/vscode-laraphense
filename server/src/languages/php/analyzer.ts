'use strict';

import { Tree } from '../../parsers/bladeParser/bladeAst';
import { Block, Namespace, Program } from 'php-parser';
import { PhpSymbol, PhpSymbolKind, SymbolTable } from './indexing/tables/symbolTable';
import { PhpReference, ReferenceTable } from './indexing/tables/referenceTable';
import { RelativeUri, WorkspaceFolder } from '../../support/workspaceFolder';
import { FunctionVisitor } from './analyzing/visitors/FunctionVisitor';
import { InterfaceVisitor } from './analyzing/visitors/InterfaceVisitor';
import { UseGroupVisitor } from './analyzing/visitors/ImportGroupVisitor';
import { ClassVisitor } from './analyzing/visitors/ClassDeclarationVisitor';
import { TraitVisitor } from './analyzing/visitors/TraitVisitor';
import { EnumVisitor } from './analyzing/visitors/EnumVisitor';
import { TraitUseVisitor } from './analyzing/visitors/TraitUseVisitor';
import { PropertyVisitor } from './analyzing/visitors/PropertyVisitor';
import { ClassConstantVisitor } from './analyzing/visitors/ClassConstantVisitor';
import { MethodVisitor } from './analyzing/visitors/MethodVisitor';
import { joinNamespace, splitNamespace } from '../../helpers/symbol';
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
import { NamespaceResolver } from './namespaceResolver';

export type TreeLike = {
    kind: string;
    children?: Array<any>;
    body?: Array<any> | Block;
};

export type Fqcn = string & { readonly Fqcn: unique symbol };
export type Fqsen = string & { readonly Fqsen: unique symbol };
export type Selector = string & { readonly Selector: unique symbol };

export interface NodeVisitor {
    /**
     * Hook that runs before the AST traversal starts.
     * Can be used to initialize data or perform setup tasks.
     *
     * @param rootNode The root node of the AST.
     */
    beforeTraversal?: (rootNode: TreeLike) => Promise<void>;

    /**
     * Method that runs on each node during AST traversal.
     * Used to perform the main processing logic for each stage.
     *
     * @param node The current node in the AST being visited.
     */
    visitSymbol(node: TreeLike): boolean;
    visitReference(node: TreeLike): boolean;

    /**
     * Hook that runs after the AST traversal is complete.
     * Can be used for cleanup or final processing.
     *
     * @param rootNode The root node of the AST.
     */
    afterTraversal?: (rootNode: TreeLike) => Promise<void>;
}

export class ProgramVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(_node: Program): boolean {
        // when parsing blade file we may get program, so fix scope
        this.analyzer.resetScope();
        return true;
    }
    visitReference(_node: Program): boolean {
        return true;
    }
}

export class NamespaceVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: Namespace): boolean {
        if (Array.isArray(node.name)) {
            this.analyzer.resetScope();
            return true;
        }

        // todo: we need loc of namespace name instead of given loc
        this.analyzer.setScope(createSymbol(node.name, PhpSymbolKind.Namespace, node.loc, ''));
        return true;
    }

    visitReference(_node: Program): boolean {
        return true;
    }
}

export class Analyzer {
    private _namespace: string = '';
    private _member?: PhpSymbol = undefined;
    private _subMember?: PhpSymbol = undefined;

    private _uri: RelativeUri = '' as RelativeUri;
    private _visitorMap: Record<string, NodeVisitor>;

    private _stateStack: string[] = [];
    private _symbolReferenceLinker: SymbolReferenceLinker;

    constructor(
        private _symbolTable: SymbolTable,
        private _referenceTable: ReferenceTable,
        namespaceResolver: NamespaceResolver,
        stubsFolder?: WorkspaceFolder
    ) {
        this._symbolReferenceLinker = new SymbolReferenceLinker(
            _symbolTable,
            _referenceTable,
            namespaceResolver,
            stubsFolder
        );

        this._visitorMap = {
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

    public analyze(tree: Tree, uri: RelativeUri, steps: number = 1) {
        this._uri = uri;

        this.resetState();
        // await this.traverseAST(ast, this.stages.slice(0, steps - 1));
        this.traverseAST(tree);
    }

    public get scope(): string {
        const namespace = joinNamespace(this._namespace, this._member?.name || '');
        if (!this._subMember) {
            return namespace;
        }

        return namespace + ':' + this._subMember.name;
    }

    public setScope(symbol: PhpSymbol) {
        this._stateStack.push(symbol.name);
        // join if parent child, else set
        this._namespace = symbol.name;
        // this.namespace = this.isParent ? joinNamespace(this.namespace, symbol.name) : symbol.name;
        symbol.uri = this._uri;
        this._symbolTable.addSymbol(symbol);
        this.resetMember();
    }

    public setMember(symbol: PhpSymbol) {
        this.addSymbol(symbol);
        if (
            [
                PhpSymbolKind.Class,
                PhpSymbolKind.Interface,
                PhpSymbolKind.Trait,
                PhpSymbolKind.Enum,
                PhpSymbolKind.Function,
            ].includes(symbol.kind)
        ) {
            this._member = symbol;
        }
    }

    public setSubMember(symbol: PhpSymbol) {
        this.addSymbol(symbol);
        if ([PhpSymbolKind.Method].includes(symbol.kind)) {
            this._subMember = symbol;
        }
    }

    public resetMember(): string {
        this._member = undefined;
        this._subMember = undefined;
        return this.scope;
    }

    public resetSubMember(): string {
        this._subMember = undefined;
        return this.scope;
    }

    public resetScope() {
        this._namespace = '';
        this.resetMember();
    }

    public resetState() {
        this._namespace = '';
        this._member = undefined;
    }

    public addSymbol(symbol: PhpSymbol) {
        symbol.uri = this._uri;
        this._symbolTable.addSymbol(symbol);

        this._symbolReferenceLinker.linkReferencesToSymbol(symbol);

        return symbol;
    }

    public addImportStatement(importStatement: PhpReference) {
        importStatement.id = this._referenceTable.generateId();
        importStatement.uri = this._uri;
        this._symbolReferenceLinker.addImport(importStatement); // @note try to link so that it doesn't go to pending
        this._referenceTable.addImport(importStatement);
    }

    public addReference(reference: PhpReference) {
        reference.id = this._referenceTable.generateId();
        reference.uri = this._uri;
        reference.fqn = joinNamespace(this._namespace, reference.name);
        this._symbolReferenceLinker.linkReference(reference); // @note try to link so that it doesn't go to pending
        this._referenceTable.addReference(reference);
    }

    private traverseAST(treeNode: TreeLike) {
        let shouldDescend = this.visitor(treeNode);

        if (!shouldDescend) {
            return;
        }

        let child = treeNode.children ?? treeNode.body;

        if (!child) {
            return;
        }

        if (!Array.isArray(child)) {
            child = [child];
        }

        // console.log('enter state', treeNode.kind);
        for (let i = 0, l = child.length; i < l; i++) {
            this.traverseAST(child[i]);
        }
        if (treeNode.kind === 'namespace') {
            if (this._stateStack.length !== 1) {
                // console.log(this.uri);
            }

            this._stateStack.pop();
        }
        // console.log('exit state', treeNode.kind);
    }

    private visitor(node: TreeLike): boolean {
        if (['tree', 'block'].includes(node.kind)) {
            return true;
        }
        const visitor = this._visitorMap[node.kind];
        if (!visitor) {
            return false;
        }

        if (visitor) {
            const results = [visitor.visitSymbol(node), visitor.visitReference(node)];
            return results.some((result) => result);
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
            // console.log(node);
        }

        return false;
    }
}

class SymbolReferenceLinker {
    constructor(
        private symbolTable: SymbolTable,
        private referenceTable: ReferenceTable,
        private resolver: NamespaceResolver,
        private stubsFolder?: WorkspaceFolder
    ) {
        this.resolver.clearImports();
    }

    public addImport(importStatement: PhpReference) {
        this.resolver.addImport(importStatement);
        this.linkReference(importStatement, true);
    }

    public linkReferencesToSymbol(symbol: PhpSymbol) {
        const references = this.referenceTable.findPendingByFqn(joinNamespace(symbol.scope, symbol.name));

        if (references) {
            references.forEach((reference) => {
                reference.symbolId = symbol.id;
                symbol.referenceIds.add(reference.id);
            });
        }
    }

    public linkReference(reference: PhpReference, isImport: boolean = false) {
        const result = this.findSymbolForReference(reference, isImport);

        if (!result) return false;

        reference.symbolId = result.symbol.id;
        reference.isGlobal = result.isGlobal;
        result.symbol.referenceIds.add(reference.id);
        return true;
    }

    private findSymbolForReference(
        reference: PhpReference,
        isImport: boolean = true
    ): { symbol: PhpSymbol; isGlobal: boolean } | undefined {
        if (!isImport) {
            reference.fqn = this.resolver.resolveFromImport(reference);
        }

        if (this.stubsFolder) {
            let symbol = this.stubsFolder.symbolTable.findSymbolByFqn(splitNamespace(reference.fqn));
            if (symbol) return { symbol, isGlobal: true };
        }

        let symbol = this.symbolTable.findSymbolByFqn(splitNamespace(reference.fqn));
        if (symbol) return { symbol, isGlobal: false };

        return undefined;
    }
}

