'use strict';

import { Location as ParserLocation, Position as ParserPosition } from 'php-parser';
import { Position as LSPPosition, Range } from 'vscode-languageserver';
import { Location, Position } from '../../types/bladeAst';
import { Fqcn, Fqsen, Selector, SymbolKind } from './tables/symbolTable';

export function toPosition(pos: ParserPosition): Position {
    return { offset: pos.offset, line: pos.line, character: pos.column + 1 };
}

export function toLocation(loc: ParserLocation): Location {
    return { start: toPosition(loc.start), end: toPosition(loc.end) };
}

export function toLSPRange(location: ParserLocation): Range {
    return Range.create(toLSPPosition(location.start), toLSPPosition(location.end));
}

export function toLSPPosition(position: ParserPosition) {
    return LSPPosition.create(position.line, position.column);
}

export function toFqsen(kind: SymbolKind, name: string, containerName: string | undefined): Fqsen {
    let fqcn = containerName || '';

    switch (kind) {
        case SymbolKind.Function || SymbolKind.Method:
            return `${fqcn}:(${name}` as Fqsen;
        case SymbolKind.Property:
            return `${fqcn}:$${name}` as Fqsen;
        case SymbolKind.Constant || SymbolKind.EnumMember:
            return `${fqcn}::${name}` as Fqsen;
        case SymbolKind.Class || SymbolKind.Interface || SymbolKind.Enum || SymbolKind.Trait:
            return toFqcn(name, containerName) as unknown as Fqsen;
        default:
            console.log('default fqsen', kind, name, containerName);

            return `${fqcn}:${name}` as Fqsen;
    }
}

export function toSelector(kind: SymbolKind, name: string): Selector {
    switch (kind) {
        case SymbolKind.Function || SymbolKind.Method:
            return `:(${name}` as Selector;
        case SymbolKind.Property:
            return `:$${name}` as Selector;
        case SymbolKind.Constant || SymbolKind.EnumMember:
            return `::${name}` as Selector;
        default:
            console.log('default selector', kind, name);
            return `:${name}` as Selector;
    }
}

export function toFqcn(name: string, containerName: string | undefined): Fqcn {
    let separator = '\\';
    if (!containerName) {
        containerName = '';
        separator = '';
    }

    return `${containerName}${separator}${name}` as Fqcn;
}

export function psr4Path(namespace: string, paths: string[], mapping?: { [vendor: string]: string }): string {
    const namespaceParts = namespace.split('\\');

    let maxScore = 0;
    let maxScorePath = '';

    for (const path of paths) {
        const score = calculateScore(namespaceParts, path, mapping);
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

