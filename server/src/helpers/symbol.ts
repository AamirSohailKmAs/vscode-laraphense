'use strict';

import { Location as ParserLocation, Position as ParserPosition } from 'php-parser';
import { Position as LSPPosition, Range } from 'vscode-languageserver';
import { Location, Position } from '../types/bladeAst';

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
