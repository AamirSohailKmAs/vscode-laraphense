'use strict';

import { Tree } from '../../parsers/bladeParser/bladeAst';
import { AttrGroup, Block, Namespace, Program } from 'php-parser';
import { PhpSymbol, PhpSymbolKind, SymbolTable } from './indexing/tables/symbolTable';
import { PhpReference, ReferenceTable } from './indexing/tables/referenceTable';
import { RelativeUri, WorkspaceFolder } from '../../support/workspaceFolder';
import { joinNamespace, splitNamespace } from '../../helpers/symbol';
import { FunctionVisitor } from './analyzing/statementVisitors/FunctionVisitor';
import { InterfaceVisitor } from './analyzing/statementVisitors/InterfaceVisitor';
import { UseGroupVisitor } from './analyzing/statementVisitors/ImportGroupVisitor';
import { ClassVisitor } from './analyzing/statementVisitors/ClassDeclarationVisitor';
import { TraitVisitor } from './analyzing/statementVisitors/TraitVisitor';
import { EnumVisitor } from './analyzing/statementVisitors/EnumVisitor';
import { TraitUseVisitor } from './analyzing/statementVisitors/TraitUseVisitor';
import { PropertyVisitor } from './analyzing/statementVisitors/PropertyVisitor';
import { ClassConstantVisitor } from './analyzing/statementVisitors/ClassConstantVisitor';
import { MethodVisitor } from './analyzing/statementVisitors/MethodVisitor';
import { IfVisitor } from './analyzing/statementVisitors/IfVisitor';
import { ForVisitor } from './analyzing/statementVisitors/ForVisitor';
import { ForeachVisitor } from './analyzing/statementVisitors/ForeachVisitor';
import { ReturnVisitor } from './analyzing/statementVisitors/ReturnVisitor';
import { EnumCaseVisitor } from './analyzing/statementVisitors/EnumCaseVisitor';
import { WhileVisitor } from './analyzing/statementVisitors/WhileVisitor';
import { SwitchVisitor } from './analyzing/statementVisitors/SwitchVisitor';
import { UnsetVisitor } from './analyzing/statementVisitors/UnsetVisitor';
import { EchoVisitor } from './analyzing/statementVisitors/EchoVisitor';
import { ConstantStatementVisitor } from './analyzing/statementVisitors/ConstantStatementVisitor';
import { createSymbol } from '../../helpers/analyze';
import { NamespaceResolver } from './namespaceResolver';
import { ExpressionStatementVisitor } from './analyzing/statementVisitors/ExpressionStatementVisitor';
import { ThrowVisitor } from './analyzing/statementVisitors/ThrowVisitor';
import { SymbolReferenceLinker } from './SymbolReferenceLinker';
import { ExpressionVisitor } from './analyzing/expressionVisitors/ExpressionVisitor';

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
    private ignoreNodes = [
        'noop',
        'declare',
        'inline',
        'element',
        'language',

        'assign',
        'break',
        'call',
        'do',
        'declare',
        'continue',
        'throw',
        'try',
        'static',
        'goto',
        'label',
        'global',
        'variable',
        'yield',
    ];

    private _stateStack: string[] = [];
    private _symbolReferenceLinker: SymbolReferenceLinker;
    public debug: Map<string, TreeLike> = new Map();
    private expressionVisitor: ExpressionVisitor;

    constructor(
        private _symbolTable: SymbolTable<PhpSymbolKind, PhpSymbol>,
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

        this.expressionVisitor = new ExpressionVisitor(this);

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
            // call: new CallVisitor(this), //@note important

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

            // continue: new ContinueVisitor(this),
            throw: new ThrowVisitor(this, this.expressionVisitor),
            // try: new TryVisitor(this),
            expressionstatement: new ExpressionStatementVisitor(this, this.expressionVisitor),

            return: new ReturnVisitor(this), // todo:
            // Add other visitors here
        };
    }

    public analyze(tree: Tree, uri: RelativeUri, steps: number) {
        this._uri = uri;

        this.debug = new Map();
        this.resetState();
        this.traverseAST(tree, steps);
        if (this.debug.size > 0) {
            console.log(this.debug, uri);
        }
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
        reference.scope = joinNamespace(this._namespace, reference.name);
        this._symbolReferenceLinker.linkReference(reference); // @note try to link so that it doesn't go to pending
        this._referenceTable.addReference(reference);
    }

    private traverseAST(treeNode: TreeLike, steps: number) {
        let shouldDescend = this.visitor(treeNode, steps);

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
            this.traverseAST(child[i], steps);
        }
        if (treeNode.kind === 'namespace') {
            if (this._stateStack.length !== 1) {
                // console.log(this.uri);
            }

            this._stateStack.pop();
        }
        // console.log('exit state', treeNode.kind);
    }

    private visitor(node: TreeLike, steps: number): boolean {
        if (['tree', 'block'].includes(node.kind)) {
            return true;
        }
        const visitor = this._visitorMap[node.kind];
        if (!visitor) {
            if (!this.ignoreNodes.includes(node.kind)) {
                // this.debug.set(node.kind, node);
                // console.log(node);
            }
            return false;
        }

        let results = [visitor.visitSymbol(node)];
        if (steps > 1) {
            results = results.concat(visitor.visitReference(node));
        }
        return results.some((result) => result);
    }
}

