'use strict';

import { Location, Position as ParserPosition } from 'php-parser';
import { Position, Range } from 'vscode-languageserver';

export function toLSPRange(location: Location): Range {
    return Range.create(toLSPPosition(location.start), toLSPPosition(location.end));
}

export function toLSPPosition(position: ParserPosition) {
    return Position.create(position.line, position.column);
}

