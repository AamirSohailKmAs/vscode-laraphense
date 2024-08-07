'use strict';

import { Tree } from '../../bladeParser/bladeAst';

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
    MODIFIER_PRIVATE,
    MODIFIER_PUBLIC,
    MODIFIER_PROTECTED,
    UseGroup,
    TraitUse,
    StaticLookup,
    TraitPrecedence,
    TraitAlias,
    NullKeyword,
} from 'php-parser';
import { PhpSymbol, SymbolKind, SymbolModifier, SymbolTable } from './indexing/tables/symbolTable';
import { PhpReference, ReferenceTable } from './indexing/tables/referenceTable';
import { RelativeUri } from '../../support/workspaceFolder';
import { toFqcn, toFqsen } from './indexing/symbol';

export type TreeLike = {
    kind: string;
    children?: Array<any>;
    body?: Array<any>;
};

export class Analyzer {
    symbols: PhpSymbol[] = [];
    references: PhpReference[] = [];
    containerName: string = '';
    uri: RelativeUri = '' as RelativeUri;
    member?: PhpSymbol = undefined;

    private symbolTable: SymbolTable;
    private referenceTable: ReferenceTable;

    private unresolvedReferences: Map<string, PhpReference[]> = new Map();

    constructor(symbolTable: SymbolTable, referenceTable: ReferenceTable) {
        this.symbolTable = symbolTable;
        this.referenceTable = referenceTable;
    }

    public analyse(tree: Tree, uri: RelativeUri) {
        this._reset();
        this.uri = uri;

        this._traverseAST(tree, this._visitor.bind(this));

        // this.resolveUnresolvedReferences();

        return { symbols: this.symbols, references: this.references, unresolvedReferences: this.unresolvedReferences };
    }

    private _reset() {
        this.symbols = [];
        this.references = [];
        this.containerName = '';
        this.member = undefined;
        this.unresolvedReferences = new Map();
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

        // symbol.id = this.symbolTable.generateId();

        return symbol;
    }

    private _newReference(name: string | Identifier, kind: SymbolKind, loc: Location | null | undefined): PhpReference {
        name = normalizeName(name);

        if (loc === null || loc === undefined) {
            loc = { source: null, start: { column: 0, line: 0, offset: 0 }, end: { column: 0, line: 0, offset: 0 } };
            console.log(`symbol ${name} of kind ${kind} does not have a location`);
        }

        const reference: PhpReference = {
            id: this.referenceTable.generateId(),
            symbolId: 0,
            name,
            kind,
            loc,
            uri: this.uri,
            // modifiers: modifiers,
            // value,
            // containerName,
        };

        // reference.id = this.referenceTable.generateId();
        return reference;
    }

    private linkReferenceToSymbol(reference: PhpReference) {
        // Find the corresponding symbol based on the current scope and context
        const symbol = this.findSymbolForReference(reference);
        if (symbol) {
            reference.symbolId = symbol.id;
            symbol.referenceIds.push(reference.id);
        } else {
            // Add to unresolved references if no symbol is found
            if (!this.unresolvedReferences.has(reference.name)) {
                this.unresolvedReferences.set(reference.name, []);
            }
            this.unresolvedReferences.get(reference.name)!.push(reference);
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

    private _analyseUseGroup(node: UseGroup): boolean {
        if (node.items) {
            node.items.forEach((use) => {
                // todo: type, alias
                const reference = this._newReference(use.name, SymbolKind.Class, use.loc);
                this.references.push(reference);
                this.linkReferenceToSymbol(reference);
            });
        }

        return false;
    }

    /**
     * @link https://www.php.net/manual/en/language.oop5.traits.php
     */
    private _analyseTraitUse(node: TraitUse): boolean {
        node.traits.forEach((trait) => {
            // todo: alias, resolution
            const reference = this._newReference(trait.name, SymbolKind.Trait, trait.loc);
            this.references.push(reference);
            this.linkReferenceToSymbol(reference);
        });

        const adaptationsMap: Record<string, (node: any) => void> = {
            traitprecedence: (node: TraitPrecedence): void => {
                if (node.trait) {
                    const reference = this._newReference(node.trait, SymbolKind.Trait, node.trait.loc);
                    this.references.push(reference);
                    this.linkReferenceToSymbol(reference);
                }
                const reference = this._newReference(node.method, SymbolKind.Method, node.loc);
                this.references.push(reference);
                this.linkReferenceToSymbol(reference);

                node.instead.forEach((instead) => {
                    const reference = this._newReference(instead, SymbolKind.Trait, instead.loc);
                    this.references.push(reference);
                    this.linkReferenceToSymbol(reference);
                });
            },
            traitalias: (node: TraitAlias): void => {
                if (node.trait) {
                    const reference = this._newReference(node.trait, SymbolKind.Trait, node.trait.loc);
                    this.references.push(reference);
                    this.linkReferenceToSymbol(reference);
                }
                const reference = this._newReference(node.method, SymbolKind.Method, node.loc);
                this.references.push(reference);
                this.linkReferenceToSymbol(reference);
            },
        };
        if (node.adaptations) {
            node.adaptations.forEach((adopt) => {
                adaptationsMap[adopt.kind]?.(adopt);
            });
        }
        return false;
    }

    private _analyseFunction(node: Function): boolean {
        this.symbols.push(this._newSymbol(node.name, SymbolKind.Function, node.loc));
        // todo: Attribute, type
        this.member = undefined;
        return true;
    }

    private _analyseClass(classNode: Class): boolean {
        this.member = this._newSymbol(
            classNode.name,
            SymbolKind.Class,
            classNode.loc,
            modifier({
                isAbstract: classNode.isAbstract,
                isFinal: classNode.isFinal,
                isReadonly: classNode.isReadonly,
                isAnonymous: classNode.isAnonymous,
            })
        );
        // todo: Attribute
        this.symbols.push(this.member);
        if (classNode.extends) {
            const reference = this._newReference(classNode.extends, SymbolKind.Class, classNode.extends.loc);
            this.references.push(reference);
            this.linkReferenceToSymbol(reference);
        }
        if (classNode.implements) {
            classNode.implements.forEach((interfaceNode) => {
                // fixme: resolution, uqn,qf, rn
                const reference = this._newReference(interfaceNode.name, SymbolKind.Interface, interfaceNode.loc);
                this.references.push(reference);
                this.linkReferenceToSymbol(reference);
            });
        }
        return true;
    }

    private _analyseInterface(interfaceNode: Interface): boolean {
        this.member = this._newSymbol(interfaceNode.name, SymbolKind.Interface, interfaceNode.loc);
        // todo: Attribute
        this.symbols.push(this.member);
        if (interfaceNode.extends) {
            interfaceNode.extends.forEach((interfaceNode) => {
                // fixme: resolution, uqn,qf, rn
                const reference = this._newReference(interfaceNode.name, SymbolKind.Interface, interfaceNode.loc);
                this.references.push(reference);
                this.linkReferenceToSymbol(reference);
            });
        }
        return true;
    }

    private _analyseTrait(traitNode: Trait): boolean {
        this.member = this._newSymbol(traitNode.name, SymbolKind.Trait, traitNode.loc);
        // todo: Attribute
        this.symbols.push(this.member);
        return true;
    }

    private _analyseEnum(node: Enum): boolean {
        this.member = this._newSymbol(node.name, SymbolKind.Enum, node.loc);
        // todo: Attribute, type
        this.symbols.push(this.member);
        if (node.implements) {
            node.implements.forEach((interfaceNode) => {
                // fixme: resolution, uqn,qf, rn
                const reference = this._newReference(interfaceNode.name, SymbolKind.Interface, interfaceNode.loc);
                this.references.push(reference);
                this.linkReferenceToSymbol(reference);
            });
        }
        return true;
    }

    private _analyseClassConstant(node: ClassConstant): boolean {
        //todo: Attribute
        for (const constant of node.constants) {
            this.symbols.push(
                this._newSymbol(
                    constant.name,
                    SymbolKind.Constant,
                    constant.loc,
                    modifier({ isFinal: node.final, visibility: node.visibility }),
                    constant.value,
                    toFqcn(this.member?.name || '', this.containerName)
                )
            );
        }
        return false;
    }

    private _analyseProperty(node: PropertyStatement): boolean {
        // todo: Attribute

        node.properties.forEach((prop) => {
            // todo: Attribute, type
            this.symbols.push(
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
                    prop.value,
                    toFqcn(this.member?.name || '', this.containerName)
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
        this.symbols.push(method);

        for (let i = 0; i < node.arguments.length; i++) {
            const param = node.arguments[i];
            //todo: Attribute, type, byref
            if (normalizeName(node.name) === '__construct' && param.flags > 0) {
                this.symbols.push(
                    this._newSymbol(
                        param.name,
                        SymbolKind.Property,
                        param.loc,
                        modifier({ visibility: parseFlag(param.flags) }),
                        param.value,
                        toFqcn(this.member?.name || '', this.containerName)
                    )
                );
                continue;
            }

            this.symbols.push(
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
                    toFqsen(method.kind, method.name, method.scope)
                )
            );
        }

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
            // todo: add namespace symbol for rename provider
            // todo: we need loc of namespace name instead of given loc
            // this.symbols.push(this._newSymbol(node.name, SymbolKind.Namespace, node.loc));
            return true;
        },
        usegroup: this._analyseUseGroup.bind(this), // for references
        function: this._analyseFunction.bind(this),

        class: this._analyseClass.bind(this),
        interface: this._analyseInterface.bind(this),
        trait: this._analyseTrait.bind(this),
        enum: this._analyseEnum.bind(this),

        traituse: this._analyseTraitUse.bind(this),

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
        nullkeyword: (_node: NullKeyword): string | undefined => {
            return 'null';
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
        //     node.raw;
        //     // reference can be here
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

function parseFlag(flag: MODIFIER_PUBLIC | MODIFIER_PROTECTED | MODIFIER_PRIVATE): string {
    switch (flag) {
        case 2:
            return 'protected';
        case 4:
            return 'private';
        default:
            return 'public';
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

