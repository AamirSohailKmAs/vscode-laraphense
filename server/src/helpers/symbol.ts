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
