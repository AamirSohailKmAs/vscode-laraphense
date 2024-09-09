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
import { Resolution, createSymbol, getResolution } from '../../helpers/analyze';

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
    // visit(node: TreeLike): Promise<boolean>;
    visit(node: TreeLike): boolean;

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

export class Analyzer {
    private _namespace: string = '';
    private _member?: PhpSymbol = undefined;
    private _subMember?: PhpSymbol = undefined;

    private uri: RelativeUri = '' as RelativeUri;
    private visitorMap: Record<string, NodeVisitor>;

    public stateStack: string[] = [];
    private symbolReferenceLinker: SymbolReferenceLinker;

    constructor(
        private symbolTable: SymbolTable,
        private referenceTable: ReferenceTable,
        private stubsFolder?: WorkspaceFolder
    ) {
        this.symbolReferenceLinker = new SymbolReferenceLinker(symbolTable, referenceTable, stubsFolder);

        this.visitorMap = {
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
        this.uri = uri;

        this.resetState();
        // await this.traverseAST(ast, this.stages.slice(0, steps - 1));
        this.traverseAST(tree, this.visitor.bind(this));
    }

    public get scope(): string {
        const namespace = joinNamespace(this._namespace, this._member?.name || '');
        if (!this._subMember) {
            return namespace;
        }

        return namespace + ':' + this._subMember.name;
    }

    public setScope(symbol: PhpSymbol) {
        this.stateStack.push(symbol.name);
        // join if parent child, else set
        this._namespace = symbol.name;
        // this.namespace = this.isParent ? joinNamespace(this.namespace, symbol.name) : symbol.name;
        symbol.uri = this.uri;
        this.symbolTable.addSymbol(symbol);
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
        symbol.uri = this.uri;
        this.symbolTable.addSymbol(symbol);

        this.symbolReferenceLinker.linkReferencesToSymbol(symbol);

        return symbol;
    }

    public addImportStatement(importStatement: PhpReference) {
        importStatement.id = this.referenceTable.generateId();
        importStatement.uri = this.uri;
        this.symbolReferenceLinker.addImport(importStatement); // @note try to link so that it doesn't go to pending
        this.referenceTable.addImport(importStatement);
    }

    public addReference(reference: PhpReference) {
        reference.id = this.referenceTable.generateId();
        reference.uri = this.uri;
        reference.fqn = joinNamespace(this._namespace, reference.name);
        this.symbolReferenceLinker.linkReference(reference); // @note try to link so that it doesn't go to pending
        this.referenceTable.addReference(reference);
    }

    // private async _traverseNode(node: TreeLike, stages: NodeVisitor[]): Promise<void> {
    //     let children = node.children ?? node.body;

    //     if (children && !Array.isArray(children)) {
    //         children = [children];
    //     }

    //     if (children) {
    //         await Promise.all(children.map((child) => this._traverseNode(child, stages)));
    //     }
    // }

    private traverseAST(treeNode: TreeLike, visitor: (treeNode: TreeLike) => boolean) {
        // const results = await Promise.all(stages.map((stage) => stage.visit(node)));
        // const shouldDescend = results.some((result) => result);
        let shouldDescend = visitor(treeNode);

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
            this.traverseAST(child[i], visitor);
        }
        if (treeNode.kind === 'namespace') {
            if (this.stateStack.length !== 1) {
                // console.log(this.uri);
            }

            this.stateStack.pop();
        }
        // console.log('exit state', treeNode.kind);
    }

    private visitor(node: TreeLike): boolean {
        if (['tree', 'block'].includes(node.kind)) {
            return true;
        }
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
            // console.log(node);
        }

        return false;
    }
}

class SymbolReferenceLinker {
    private imports: PhpReference[] = [];

    constructor(
        private symbolTable: SymbolTable,
        private referenceTable: ReferenceTable,
        private stubsFolder?: WorkspaceFolder
    ) {}

    public addImport(importStatement: PhpReference) {
        this.imports.push(importStatement);
        this.linkReference(importStatement, true);
    }

    public linkReferencesToSymbol(symbol: PhpSymbol) {
        const references = this.referenceTable.findPendingByFqn(joinNamespace(symbol.scope, symbol.name));

        if (references) {
            references.forEach((reference) => {
                reference.symbolId = symbol.id;
                symbol.referenceIds.push(reference.id);
            });
        }
    }

    public linkReference(reference: PhpReference, isImport: boolean = false) {
        const symbol = this.findSymbolForReference(reference, isImport);

        if (!symbol) return false;

        reference.symbolId = symbol.id;
        symbol.referenceIds.push(reference.id);
        return true;
    }

    private findSymbolForReference(reference: PhpReference, isImport: boolean = true): PhpSymbol | undefined {
        if (!isImport) {
            this.resolveFromImport(reference);
        }

        if (this.stubsFolder) {
            let symbol = this.stubsFolder.symbolTable.findSymbolByFqn(splitNamespace(reference.fqn));
            if (symbol) return symbol;
        }

        let symbol = this.symbolTable.findSymbolByFqn(splitNamespace(reference.fqn));
        if (symbol) return symbol;

        return undefined;
    }

    private resolveFromImport(ref: PhpReference) {
        const resolution = getResolution(ref.name);

        switch (resolution) {
            case Resolution.FullyQualified:
                ref.fqn = ref.name;
                break;
            case Resolution.Qualified:
                this.resolveQualified(ref);
                break;

            default:
                this.resolveUnqualified(ref);
                break;
        }
    }

    private resolveQualified(ref: PhpReference) {
        const relative = ref.name.substring(0, ref.name.indexOf('\\'));
        const use = this.imports.find((use) => use.name.endsWith(relative));

        if (!use) return undefined;

        ref.fqn = joinNamespace(use.fqn, ref.name.substring(ref.name.indexOf('\\')));
    }

    private resolveUnqualified(ref: PhpReference) {
        const use = this.imports.find((use) => use.alias === ref.name || use.name.endsWith(ref.name));
        if (!use) return undefined;

        ref.fqn = use.fqn;
    }
}

