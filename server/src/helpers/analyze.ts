'use strict';

import {
    Identifier,
    Node,
    Number as ParserNumber,
    String as ParserString,
    Boolean as ParserBoolean,
    Array as ParserArray,
    MODIFIER_PRIVATE,
    MODIFIER_PUBLIC,
    MODIFIER_PROTECTED,
    NullKeyword,
    Location as ParserLocation,
    TypeReference,
    SelfReference,
    Name,
    UnionType,
} from 'php-parser';
import { PhpSymbol, PhpSymbolKind, SymbolModifier } from '../languages/php/indexing/tables/symbolTable';
import { RelativeUri } from '../support/workspaceFolder';
import { PhpReference } from '../languages/php/indexing/tables/referenceTable';
import { Value, ValueKind } from './symbol';
import { PhpType, SELF_NAME, UNION_NAME_SYMBOL, createType } from './type';
import { Location } from '../parsers/ast';

export function createSymbol(
    name: string | Identifier,
    kind: PhpSymbolKind,
    loc: ParserLocation | null | undefined,
    scope: string,
    modifiers: SymbolModifier[] = [],
    type?: Identifier | Identifier[] | null,
    value?: string | number | boolean | Node | null
): PhpSymbol {
    name = normalizeName(name).name;
    const typeObject = normalizeTypes(type);
    const valueObject = normalizeValue(value);

    if (loc === null || loc === undefined) {
        console.log(`symbol ${name} of kind ${kind} does not have a location`);
    }

    const symbol: PhpSymbol = {
        id: 0,
        name,
        kind,
        loc: normalizeLocation(loc),
        uri: '' as RelativeUri,
        modifiers,
        value: valueObject,
        scope,
        type: { declared: typeObject },
        throws: [],
        referenceIds: [],
        relatedIds: [],
    };

    return symbol;
}

export function createReference(
    name: string | Identifier,
    kind: PhpSymbolKind,
    loc: ParserLocation | null | undefined,
    fqn: string = '',
    alias?: string
): PhpReference {
    name = normalizeName(name).name;

    if (loc === null || loc === undefined) {
        console.log(`symbol ${name} of kind ${kind} does not have a location`);
    }

    const reference: PhpReference = {
        id: 0,
        symbolId: 0,
        name,
        kind,
        loc: normalizeLocation(loc),
        fqn,
        alias,
        isGlobal: false,
        uri: '' as RelativeUri,
    };

    return reference;
}

export function normalizeLocation(loc: ParserLocation | null | undefined): Location {
    if (loc === null || loc === undefined) {
        return { start: { character: 0, line: 0, offset: 0 }, end: { character: 0, line: 0, offset: 0 } };
    }

    return {
        start: {
            character: loc.start.column ?? 0,
            line: loc.start.line ?? 0,
            offset: loc.start.offset ?? 0,
        },
        end: {
            character: loc.end.column ?? 0,
            line: loc.end.line ?? 0,
            offset: loc.end.offset ?? 0,
        },
    };
}

export function normalizeName(name: string | Identifier): { name: string; offset: number } {
    let offset = 0;
    if (typeof name !== 'string') {
        offset = name.loc?.start.offset ?? 0;
        name = name.name;
    }
    return { name, offset };
}

export function normalizeValue(value: string | number | boolean | Node | null | undefined): Value | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value === 'string') {
        return { raw: `'${value}'`, kind: ValueKind.String };
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
        return { raw: `${value}`, kind: ValueKind.Number };
    }
    if (typeof value === 'boolean') {
        return { raw: `${value}`, kind: ValueKind.Boolean };
    }

    const valueMap: Record<string, (node: any) => Value | undefined> = {
        number: (node: ParserNumber): Value | undefined => {
            return { raw: node.raw ?? `${node.value}`, kind: ValueKind.Number };
        },
        string: (node: ParserString): Value | undefined => {
            return { raw: node.raw, kind: ValueKind.String };
        },
        boolean: (node: ParserBoolean): Value | undefined => {
            return { raw: node.raw, kind: ValueKind.Boolean };
        },
        nullkeyword: (_node: NullKeyword): Value | undefined => {
            return { raw: 'null', kind: ValueKind.Null };
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

export function normalizeTypes(type: Identifier | Identifier[] | null | undefined): PhpType | undefined {
    if (type === undefined || type === null) {
        return undefined;
    }

    const valueMap: Record<string, (node: any) => PhpType> = {
        name: (node: Name): PhpType => {
            return createType(node.name);
        },
        typereference: (node: TypeReference): PhpType => {
            return createType(node.name);
        },
        selfreference: (_node: SelfReference): PhpType => {
            return createType(SELF_NAME);
        },
        uniontype: (node: UnionType): PhpType => {
            const items: PhpType[] = [];
            for (let i = 0; i < node.types.length; i++) {
                const result = valueMap[node.types[i].kind]?.(node.types[i]);
                if (result) {
                    items.push(result);
                } else {
                    console.log(node.types[i]);
                }
            }
            return createType(UNION_NAME_SYMBOL, items);
        },
    };

    const items: PhpType[] = [];

    if (Array.isArray(type)) {
        for (let i = 0; i < type.length; i++) {
            const result = valueMap[type[i].kind]?.(type[i]);
            if (result) {
                items.push(result);
            }
        }
        return createType(UNION_NAME_SYMBOL, items);
    }

    return valueMap[type.kind]?.(type);
}

export type modifierFlag = {
    isAbstract?: boolean;
    isFinal?: boolean;
    isReadonly?: boolean;
    isAnonymous?: boolean;
    isStatic?: boolean;
    isNullable?: boolean;
    isVariadic?: boolean;
    visibility?: string | null;
};
export function modifier(flags?: modifierFlag): SymbolModifier[] {
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

export function normalizeVisibility(visibility: string | null): SymbolModifier {
    switch (visibility) {
        case 'private':
            return SymbolModifier.Private;
        case 'protected':
            return SymbolModifier.Protected;
        case 'public':
            return SymbolModifier.Public;
        default:
            return SymbolModifier.Public;
    }
}

export function parseFlag(flag: MODIFIER_PUBLIC | MODIFIER_PROTECTED | MODIFIER_PRIVATE): string {
    switch (flag) {
        case 2:
            return 'protected';
        case 4:
            return 'private';
        default:
            return 'public';
    }
}

export enum Resolution {
    FullyQualified,
    Qualified,
    UnQualified,
}

export function getResolution(name: string) {
    if (name.startsWith('\\')) {
        return Resolution.FullyQualified;
    }

    if (name.includes('\\')) {
        return Resolution.Qualified;
    }

    return Resolution.UnQualified;
}

