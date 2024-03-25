'use strict';

import {
    Class,
    ClassConstant,
    Enum,
    Function,
    Identifier,
    Interface,
    Location,
    Method,
    Namespace,
    Node,
    Number as ParserNumber,
    String as ParserString,
    Boolean as ParserBoolean,
    Array as ParserArray,
    Program,
    PropertyStatement,
    Trait,
    Block,
} from 'php-parser';
import { Fqsen, PhpSymbol, SymbolKind, SymbolModifier } from './indexing/tables/symbolTable';
import { Tree } from '../types/bladeAst';
import { RelativePathId } from './indexing/workspaceFolder';
import { toFqcn, toFqsen } from './indexing/symbol';

export type TreeLike = {
    kind: string;
    children?: Array<any>;
    body?: Array<any>;
};

export class Analyser {
    memberSymbols: PhpSymbol[] = [];
    children: Map<Fqsen, PhpSymbol[]> = new Map();
    containerName: string | undefined = undefined;
    member?: PhpSymbol = undefined;

    public analyse(tree: Tree) {
        this._reset();
        this._traverseAST(tree, this._visitor.bind(this));

        return { symbols: this.memberSymbols, children: this.children };
    }

    private _reset() {
        this.memberSymbols = [];
        this.children = new Map();
        this.containerName = undefined;
        this.member = undefined;
    }

    private _traverseAST(treeNode: TreeLike, visitor: (treeNode: TreeLike) => boolean) {
        let shouldDescend = visitor(treeNode);
        const child = treeNode.children ?? treeNode.body;

        if (child && shouldDescend) {
            for (let i = 0, l = child.length; i < l; i++) {
                this._traverseAST(child[i], visitor);
            }
        }
    }

    private _visitor(node: TreeLike): boolean {
        return this.visitorMap[node.kind]?.(node) ?? false;
    }

    private _newSymbol(
        name: string | Identifier,
        kind: SymbolKind,
        loc: Location | null,
        modifiers: SymbolModifier[] = [],
        value?: string | number | boolean | Node | null,
        containerName?: string
    ): PhpSymbol {
        name = normalizeName(name);
        value = normalizeValue(value);
        if (!containerName) {
            containerName = this.containerName;
        }

        if (loc === null) {
            loc = { source: null, start: { column: 0, line: 0, offset: 0 }, end: { column: 0, line: 0, offset: 0 } };
            console.log(`symbol ${name} of kind ${kind} does not have a location`);
        }

        return {
            name,
            kind,
            loc,
            path: '' as RelativePathId,
            modifiers: modifiers,
            value,
            containerName,
        } satisfies PhpSymbol;
    }

    private addChildrenSymbol(symbol: PhpSymbol, parent?: PhpSymbol) {
        parent = parent ?? this.member;
        if (!parent) return;

        const key = toFqsen(parent.kind, parent.name, parent.containerName);
        const symbols = this.children.get(key) || [];

        symbols.push(symbol);

        this.children.set(key, symbols);
    }

    private _analyseFunction(node: Function): boolean {
        this.memberSymbols.push(this._newSymbol(node.name, SymbolKind.Function, node.loc));
        // todo: Attribute, type
        this.member = undefined;
        return true;
    }

    private _analyseClass(node: Class): boolean {
        this.member = this._newSymbol(
            node.name,
            SymbolKind.Class,
            node.loc,
            modifier({
                isAbstract: node.isAbstract,
                isFinal: node.isFinal,
                isReadonly: node.isReadonly,
                isAnonymous: node.isAnonymous,
            })
        );
        // todo: Attribute
        this.memberSymbols.push(this.member);
        return true;
    }

    private _analyseInterface(node: Interface): boolean {
        this.member = this._newSymbol(node.name, SymbolKind.Interface, node.loc);
        // todo: Attribute
        this.memberSymbols.push(this.member);
        return true;
    }

    private _analyseTrait(node: Trait): boolean {
        this.member = this._newSymbol(node.name, SymbolKind.Trait, node.loc);
        // todo: Attribute
        this.memberSymbols.push(this.member);
        return true;
    }

    private _analyseEnum(node: Enum): boolean {
        this.member = this._newSymbol(node.name, SymbolKind.Enum, node.loc);
        // todo: Attribute, type
        this.memberSymbols.push(this.member);
        return true;
    }

    private _analyseClassConstant(node: ClassConstant): boolean {
        //todo: Attribute
        for (const constant of node.constants) {
            this.addChildrenSymbol(
                this._newSymbol(
                    constant.name,
                    SymbolKind.Constant,
                    constant.loc,
                    modifier({ isFinal: node.final, visibility: node.visibility }),
                    constant.value
                )
            );
        }
        return false;
    }

    private _analyseProperty(node: PropertyStatement): boolean {
        // todo: Attribute

        node.properties.forEach((prop) => {
            // todo: Attribute, type
            this.addChildrenSymbol(
                this._newSymbol(
                    prop.name,
                    SymbolKind.Property,
                    node.loc,
                    modifier({
                        isReadonly: prop.readonly,
                        isStatic: node.isStatic,
                        isNullable: prop.nullable,
                        visibility: node.visibility,
                    }),
                    prop.value
                )
            );
        });
        return false;
    }

    private _analyseMethod(node: Method): boolean {
        // todo: Attribute, type, byref
        const method = this._newSymbol(
            node.name,
            SymbolKind.Method,
            node.loc,
            modifier({
                isAbstract: node.isAbstract,
                isFinal: node.isFinal,
                isStatic: node.isStatic,
                isNullable: node.nullable,
                visibility: node.visibility,
            }),
            undefined,
            toFqcn(this.member?.name || '', this.containerName)
        );
        this.addChildrenSymbol(method);

        node.arguments.forEach((param) => {
            //todo: Attribute, type, byref, flags: MODIFIER_PUBLIC | MODIFIER_PROTECTED | MODIFIER_PRIVATE;
            // fixme: if node.name is __construct and parse flags then these are properties of member
            if (normalizeName(node.name) === '__construct' && param.flags > 0) {
                // console.log(method);
            } else {
                this.addChildrenSymbol(
                    this._newSymbol(
                        param.name,
                        SymbolKind.Parameter,
                        param.loc,
                        modifier({
                            isReadonly: param.readonly,
                            isNullable: param.nullable,
                            isVariadic: param.variadic,
                        }),
                        param.value,
                        toFqsen(method.kind, method.name, method.containerName)
                    ),
                    method
                );
            }
        });

        if (node.body) {
            // should go inside and get the symbols and references
            this._analyseInsideMethod(node.body, method);
        }
        return false;
    }

    private _analyseInsideMethod(body: Block, method: PhpSymbol) {
        // body.children.forEach((param) => {
        //     this.addChildrenSymbol(this._newSymbol(param.name, SymbolKind.Variable, param.loc), method);
        // });
    }

    // references
    private visitorMap: Record<string, (node: any) => boolean> = {
        tree: (_node: Tree): boolean => {
            this._reset();
            return true;
        },
        program: (_node: Program): boolean => {
            this.member = undefined;
            return true;
        },
        namespace: (node: Namespace): boolean => {
            this.containerName = node.name;
            this.member = undefined;
            return true;
        },
        function: this._analyseFunction.bind(this),

        class: this._analyseClass.bind(this),
        interface: this._analyseInterface.bind(this),
        trait: this._analyseTrait.bind(this),
        enum: this._analyseEnum.bind(this),

        propertystatement: this._analyseProperty.bind(this),
        classconstant: this._analyseClassConstant.bind(this),
        method: this._analyseMethod.bind(this),
    };
}

function normalizeName(name: string | Identifier) {
    if (typeof name !== 'string') {
        name = name.name;
    }
    return name;
}

function normalizeValue(value: string | number | boolean | Node | null | undefined) {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return 'null';
    }
    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'bigint'
    ) {
        return `${value}`;
    }

    const valueMap: Record<string, (node: any) => string | undefined> = {
        number: (node: ParserNumber): string | undefined => {
            return node.raw;
        },
        string: (node: ParserString): string | undefined => {
            return node.value;
        },
        boolean: (node: ParserBoolean): string | undefined => {
            return node.raw;
        },
        // array: (node: ParserArray): string | undefined => {
        //     node.raw
        //     return undefined;
        // },
        // encapsed: (node: Encapsed): string | undefined => {
        //     node.raw
        //     return undefined;
        // },
        // nowdoc: (node: Nowdoc): string | undefined => {
        //     node.raw
        //     return undefined;
        // },
        // staticlookup: (node: StaticLookup): string | undefined => {
        //     node.raw
        //     return undefined;
        // },
        // bin: (node: Bin): string | undefined => {
        //     return undefined;
        // },
        // unary: (node: Unary): string | undefined => {
        //     return undefined;
        // },
    };

    return valueMap[value.kind]?.(value);
}

type modifierFlag = {
    isAbstract?: boolean;
    isFinal?: boolean;
    isReadonly?: boolean;
    isAnonymous?: boolean;
    isStatic?: boolean;
    isNullable?: boolean;
    isVariadic?: boolean;
    visibility?: string | null;
};
function modifier(flags?: modifierFlag): SymbolModifier[] {
    const modifiers: SymbolModifier[] = [];

    if (!flags) {
        return modifiers;
    }

    if (flags.visibility !== undefined) {
        modifiers.push(normalizeVisibility(flags.visibility));
    }

    if (flags.isFinal) modifiers.push(SymbolModifier.Final);
    if (flags.isStatic) modifiers.push(SymbolModifier.Static);
    if (flags.isAbstract) modifiers.push(SymbolModifier.Abstract);
    if (flags.isReadonly) modifiers.push(SymbolModifier.ReadOnly);
    if (flags.isNullable) modifiers.push(SymbolModifier.Nullable);
    if (flags.isVariadic) modifiers.push(SymbolModifier.Variadic);
    if (flags.isAnonymous) modifiers.push(SymbolModifier.Anonymous);

    return modifiers;
}

function normalizeVisibility(visibility: string | null): SymbolModifier {
    switch (visibility) {
        case 'private':
            return SymbolModifier.Private;
        case 'protected':
            return SymbolModifier.Protected;
        default:
            return SymbolModifier.Protected;
    }
}

