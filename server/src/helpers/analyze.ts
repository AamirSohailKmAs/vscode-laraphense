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
    Location,
} from 'php-parser';
import { PhpSymbol, SymbolKind, SymbolModifier, Value, ValueKind } from '../languages/php/indexing/tables/symbolTable';
import { RelativeUri } from '../support/workspaceFolder';
import { ImportStatement, PhpReference } from '../languages/php/indexing/tables/referenceTable';
import { FQN } from './symbol';

export function createSymbol(
    name: string | Identifier,
    kind: SymbolKind,
    loc: Location | null | undefined,
    scope: string,
    modifiers: SymbolModifier[] = [],
    value?: string | number | boolean | Node | null
): PhpSymbol {
    name = normalizeName(name).name;
    const valueObject = normalizeValue(value);

    if (loc === null || loc === undefined) {
        loc = { source: null, start: { column: 0, line: 0, offset: 0 }, end: { column: 0, line: 0, offset: 0 } };
        console.log(`symbol ${name} of kind ${kind} does not have a location`);
    }

    const symbol: PhpSymbol = {
        id: 0,
        name,
        kind,
        loc,
        uri: '' as RelativeUri,
        modifiers,
        value: valueObject,
        scope,
        referenceIds: [],
        relatedIds: [],
    };

    return symbol;
}

export function createImportStatement(
    name: string | Identifier,
    alias: string,
    kind: SymbolKind,
    loc: Location | null | undefined,
    fqn: FQN = { scope: '', name: '' }
): ImportStatement {
    name = normalizeName(name).name;

    if (loc === null || loc === undefined) {
        loc = { source: null, start: { column: 0, line: 0, offset: 0 }, end: { column: 0, line: 0, offset: 0 } };
        console.log(`symbol ${name} of kind ${kind} does not have a location`);
    }

    const reference: ImportStatement = {
        id: 0,
        symbolId: 0,
        name,
        alias,
        kind,
        loc,
        fqn,
        definedIn: { scope: '', name: '' },
        uri: '' as RelativeUri,
    };

    return reference;
}

export function createReference(
    name: string | Identifier,
    kind: SymbolKind,
    loc: Location | null | undefined,
    fqn: FQN = { scope: '', name: '' },
    definedIn: FQN = { scope: '', name: '' }
): PhpReference {
    name = normalizeName(name).name;

    if (loc === null || loc === undefined) {
        loc = { source: null, start: { column: 0, line: 0, offset: 0 }, end: { column: 0, line: 0, offset: 0 } };
        console.log(`symbol ${name} of kind ${kind} does not have a location`);
    }

    const reference: PhpReference = {
        id: 0,
        symbolId: 0,
        name,
        kind,
        loc,
        fqn,
        definedIn,
        uri: '' as RelativeUri,
    };

    return reference;
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
            return { raw: node.raw, kind: ValueKind.Number };
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

