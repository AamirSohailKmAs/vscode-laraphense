'use strict';

export type Position = { line: number; character: number; offset: number };

export type Location = {
    start: Position;
    end: Position;
};

