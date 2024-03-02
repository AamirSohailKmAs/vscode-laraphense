'use strict';

import { Program } from 'php-parser';

export type Comment = {
    value: string;
};

export type ErrorMessage = {
    value: string;
};

export type HtmlAttribute = {
    name: string;
    value: string;
};

export type Element = {
    tag: string;
    attributes: HtmlAttribute[];
    children: Element[];
};

export class Tree {
    kind = 'tree';
    constructor(public children: Array<Element | Program>, public errors: ErrorMessage[] = []) {}
}

