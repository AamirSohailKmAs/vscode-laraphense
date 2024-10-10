'use strict';

import { Location as ParserLocation, Position as ParserPosition } from 'php-parser';
import { Position as LSPPosition, Range } from 'vscode-languageserver';
import { PhpSymbol, PhpSymbolKind } from '../languages/php/indexing/tables/symbolTable';
import { Fqcn, Fqsen, Selector } from '../languages/php/analyzer';
import { RelativeUri } from '../support/workspaceFolder';
import { Location, Position } from '../parsers/ast';

export type Definition<T> = {
    id: number;
    name: string;
    scope: string;
    loc: Location;
    uri: RelativeUri;
    kind: T;
};

export type Value = {
    kind: ValueKind;
    raw: string;
};

export const enum ValueKind {
    EnumMember,
    ClassConstant,
    Array,
    Null,
    String,
    Number,
    Boolean,
    Constant,
}

export function toPosition(pos: ParserPosition): Position {
    return { offset: pos.offset, line: pos.line, character: pos.column + 1 };
}

export function toLocation(loc: ParserLocation): Location {
    return { start: toPosition(loc.start), end: toPosition(loc.end) };
}

export function toLSPRange(location: Location): Range {
    return Range.create(toLSPPosition(location.start), toLSPPosition(location.end));
}

export function toLSPPosition(position: Position) {
    return LSPPosition.create(position.line - 1, position.character);
}

export function toFqsen(symbol: PhpSymbol): Fqsen {
    switch (symbol.kind) {
        case PhpSymbolKind.Class:
        case PhpSymbolKind.Interface:
        case PhpSymbolKind.Enum:
        case PhpSymbolKind.Trait:
            return joinNamespace(symbol.scope, symbol.name) as unknown as Fqsen;
        default:
            return `${symbol.scope}${toSelector(symbol.kind, symbol.name)}` as Fqsen;
    }
}

// fixme: not in use
export function splitFqsen(fqsen: Fqsen): { fqcn: Fqcn; selector: Selector } {
    const keys = fqsen.split(':');
    return { fqcn: keys[0] as Fqcn, selector: keys[1] as Selector };
}

export function toSelector(kind: PhpSymbolKind, name: string): Selector {
    switch (kind) {
        case PhpSymbolKind.Function:
        case PhpSymbolKind.Method:
            return `:${name}()` as Selector;
        case PhpSymbolKind.Property:
        case PhpSymbolKind.Parameter:
            return `:$${name}` as Selector;
        case PhpSymbolKind.Constant:
        case PhpSymbolKind.ClassConstant:
        case PhpSymbolKind.EnumMember:
            return `::${name}` as Selector;
        default:
            console.log(`default selector kind:${kind}, name:${name}`);
            return `:${name}` as Selector;
    }
}

export function psr4Path(namespace: string, paths: string[], mapping?: { [vendor: string]: string }): string {
    const namespaceParts = namespace.split('\\');

    let maxScore = 0;
    let maxScorePath = '';

    for (const path of paths) {
        let score = calculateScore(namespaceParts, path, mapping);
        if (score === maxScore && maxScore !== 0 && paths.includes('vendor')) {
            score--;
        }
        if (score > maxScore) {
            maxScore = score;
            maxScorePath = path;
        }
    }

    return maxScorePath;
}

function calculateScore(namespaceParts: string[], paths: string, mapping?: { [vendor: string]: string }): number {
    const pathParts = paths.split('/');

    let score = 0;

    while (namespaceParts.length > 0 && pathParts.length > 0) {
        const namespace = namespaceParts.pop();
        const path = pathParts.pop()?.replace('.php', '');

        if (!namespace || !path) {
            break;
        }

        if (namespace === path || (mapping && mapping[namespace] === path)) {
            score++;
        } else {
            break;
        }
    }

    return score;
}

export function joinNamespace(base: string, name: string) {
    if (!base && !name) {
        return '';
    }

    if (!base) {
        return name;
    }

    if (!name) {
        return base;
    }

    if (base.slice(-1) === '\\') {
        base = base.slice(0, -1);
    }
    if (name.slice(0, 1) === '\\') {
        name = name.slice(1);
    }
    return `${base}\\${name}`;
}
export type FQN = { scope: string; name: string };

export function splitNamespace(fqn: string): FQN {
    if (!fqn) {
        return { scope: '', name: '' };
    }
    const lastIndex = fqn.lastIndexOf('\\');
    return { scope: fqn.substring(0, lastIndex), name: fqn.substring(lastIndex + 1) };
}

