'use strict';

import { Block, Namespace, Program } from 'php-parser';
import { PhpSymbol } from './indexing/tables/symbolTable';
import { DefinitionKind } from '../../helpers/symbol';
import { PhpReference } from './indexing/tables/referenceTable';
import { joinNamespace } from '../../helpers/symbol';
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
import { ExpressionStatementVisitor } from './analyzing/statementVisitors/ExpressionStatementVisitor';
import { ThrowVisitor } from './analyzing/statementVisitors/ThrowVisitor';
import { SymbolReferenceLinker } from './SymbolReferenceLinker';
import { ExpressionVisitor } from './analyzing/expressionVisitors/ExpressionVisitor';
import { TryVisitor } from './analyzing/statementVisitors/TryVisitor';
import { DoVisitor } from './analyzing/statementVisitors/DoVisitor';
import { Tree } from '@porifa/blade-parser';
import { Steps } from '../../support/Indexer';

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
     * Method that runs on each node during AST traversal.
     * Used to perform the main processing logic for each stage.
     *
     * @param node The current node in the AST being visited.
     */
    visitSymbol(node: TreeLike): boolean;
    visitReference(node: TreeLike): boolean;
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

        // fixme: we need loc of namespace name instead of given loc
        this.analyzer.setScope(createSymbol(node.name, DefinitionKind.Namespace, node.loc, ''));
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

    private _visitorMap: Record<string, NodeVisitor>;
    private ignoreNodes = [
        'noop',
        'declare',
        'inline',
        'element',
        'language',
        'break',
        'continue',

        'static',
        'goto',
        'label',
        'global',
    ];

    private _stateStack: string[] = [];

    private expressionVisitor: ExpressionVisitor;

    constructor(private _linker: SymbolReferenceLinker) {
        this.expressionVisitor = new ExpressionVisitor(this);

        this._visitorMap = {
            program: new ProgramVisitor(this),
            namespace: new NamespaceVisitor(this),
            usegroup: new UseGroupVisitor(this),
            function: new FunctionVisitor(this, this.expressionVisitor),
            class: new ClassVisitor(this),
            interface: new InterfaceVisitor(this),
            trait: new TraitVisitor(this),
            enum: new EnumVisitor(this),

            traituse: new TraitUseVisitor(this),

            propertystatement: new PropertyVisitor(this),
            classconstant: new ClassConstantVisitor(this),
            method: new MethodVisitor(this),

            constantstatement: new ConstantStatementVisitor(this),
            enumcase: new EnumCaseVisitor(this), // todo:

            if: new IfVisitor(this, this.expressionVisitor), // todo:
            for: new ForVisitor(this, this.expressionVisitor), // todo:
            foreach: new ForeachVisitor(this, this.expressionVisitor), // todo:
            do: new DoVisitor(this, this.expressionVisitor), // todo:
            while: new WhileVisitor(this, this.expressionVisitor), // todo:
            switch: new SwitchVisitor(this, this.expressionVisitor), // todo:
            unset: new UnsetVisitor(this), // todo:
            echo: new EchoVisitor(this, this.expressionVisitor), // todo:

            throw: new ThrowVisitor(this, this.expressionVisitor),
            try: new TryVisitor(this),
            expressionstatement: new ExpressionStatementVisitor(this, this.expressionVisitor),

            return: new ReturnVisitor(this, this.expressionVisitor), // todo:
        };
    }

    public analyze(tree: Tree, steps: Steps) {
        this.resetState();
        this.traverseAST(tree, steps);
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
        this.addSymbol(symbol, false);
        this.resetMember();
    }

    public setMember(symbol: PhpSymbol) {
        this.addSymbol(symbol);
        if (
            [
                DefinitionKind.Class,
                DefinitionKind.Interface,
                DefinitionKind.Trait,
                DefinitionKind.Enum,
                DefinitionKind.Function,
            ].includes(symbol.kind)
        ) {
            this._member = symbol;
        }
    }

    public setSubMember(symbol: PhpSymbol) {
        this.addSymbol(symbol);
        if ([DefinitionKind.Method].includes(symbol.kind)) {
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

    public addSymbol(symbol: PhpSymbol, linkReference: boolean = true) {
        this._linker.addSymbol(symbol, linkReference);

        return symbol;
    }

    public addReference(reference: PhpReference, isImportStatement: boolean = false) {
        if (!isImportStatement) {
            reference.scope = joinNamespace(this._namespace, reference.name);
        }
        this._linker.addReference(reference, isImportStatement);
    }

    private traverseAST(treeNode: TreeLike, steps: Steps) {
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

    private visitor(node: TreeLike, steps: Steps): boolean {
        if (['tree', 'block'].includes(node.kind)) {
            return true;
        }
        const visitor = this._visitorMap[node.kind];
        if (!visitor) {
            if (!this.ignoreNodes.includes(node.kind)) {
                // console.log(node);
            }
            return false;
        }

        let results = [visitor.visitSymbol(node)];
        if (steps > Steps.Symbols) {
            results = results.concat(visitor.visitReference(node));
        }
        return results.some((result) => result);
    }
}

