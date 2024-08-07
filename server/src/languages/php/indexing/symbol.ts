'use strict';

import { Location as ParserLocation, Position as ParserPosition } from 'php-parser';
import { Position as LSPPosition, Range } from 'vscode-languageserver';
import { Location, Position } from '../../../bladeParser/bladeAst';
import { SymbolKind } from './tables/symbolTable';
import { Fqcn, Fqsen, Selector } from '../analyzer';

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
    return LSPPosition.create(position.line - 1, position.column);
}

export function toFqsen(kind: SymbolKind, name: string, containerName: string | undefined = ''): Fqsen {
    switch (kind) {
        case SymbolKind.Class:
        case SymbolKind.Interface:
        case SymbolKind.Enum:
        case SymbolKind.Trait:
            return toFqcn(name, containerName) as unknown as Fqsen;
        default:
            return `${containerName}${toSelector(kind, name)}` as Fqsen;
    }
}

export function splitFqsen(fqsen: Fqsen): { fqcn: Fqcn; selector: Selector } {
    const keys = fqsen.split(':');
    return { fqcn: keys[0] as Fqcn, selector: keys[1] as Selector };
}

export function toSelector(kind: SymbolKind, name: string): Selector {
    switch (kind) {
        case SymbolKind.Function:
        case SymbolKind.Method:
            return `:(${name}` as Selector;
        case SymbolKind.Property:
        case SymbolKind.Parameter:
            return `:$${name}` as Selector;
        case SymbolKind.Constant:
        case SymbolKind.ClassConstant:
        case SymbolKind.EnumMember:
            return `::${name}` as Selector;
        default:
            console.log(`default selector kind:${kind}, name:${name}`);
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

