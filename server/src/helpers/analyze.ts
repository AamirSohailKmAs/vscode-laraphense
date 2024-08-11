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
import { PhpSymbol, SymbolKind, SymbolModifier } from '../languages/php/indexing/tables/symbolTable';
import { RelativeUri } from '../support/workspaceFolder';
import { PhpReference } from '../languages/php/indexing/tables/referenceTable';
import { FQN } from './symbol';

export function createSymbol(
    name: string | Identifier,
    kind: SymbolKind,
    loc: Location | null | undefined,
    scope: string = '',
    modifiers: SymbolModifier[] = [],
    value?: string | number | boolean | Node | null
): PhpSymbol {
    name = normalizeName(name);
    value = normalizeValue(value);

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
        value,
        scope,
        referenceIds: [],
    };

    return symbol;
}

export function createReference(
    name: string | Identifier,
    kind: SymbolKind,
    loc: Location | null | undefined,
    fqn: FQN = { scope: '', name: '' }
): PhpReference {
    name = normalizeName(name);

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
        uri: '' as RelativeUri,
    };

    return reference;
}

export function normalizeName(name: string | Identifier) {
    if (typeof name !== 'string') {
        name = name.name;
    }
    return name;
}

export function normalizeValue(value: string | number | boolean | Node | null | undefined) {
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
        default:
            return SymbolModifier.Protected;
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

