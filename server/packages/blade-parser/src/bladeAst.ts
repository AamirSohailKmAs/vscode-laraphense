'use strict';

import { Program } from 'php-parser';

export type Position = { line: number; character: number; offset: number };

export type Location = {
    start: Position;
    end: Position;
};

export enum TokenKind {
    EOF = 'end of file', // end of file

    JS = 'js',
    PHP = 'php',
    CSS = 'css',
    HTML = 'html',
    TEXT = 'some text',

    DIRECTIVE = 'directive',

    TAG_NAME = 'tag name',
    ATTRIBUTE = 'attribute',
    ATTRIBUTE_VALUE = 'attribute value',
    HTML_COMMENT = 'html comment',
    // HTML_COMMENT_START = 'HTML_COMMENT_START', // <!--
    // HTML_COMMENT_END = 'HTML_COMMENT_END', // -->

    // PHP_TAG_START = '<?php', // auto complete these
    // PHP_TAG_END = '?>', // auto complete these
    // PHP_ECHO_START = '<?=', // auto complete these
    BLADE_COMMENT = 'blade comment',
    BLADE_COMMENT_START = '{{--',
    BLADE_COMMENT_END = '--}}',
    BLADE_RAW_END = '!!}',
    BLADE_RAW_START = '{!!',
    BLADE_ECHO_START = '{{',
    BLADE_ECHO_END = '}}',

    EQUAL = '=', // =
    ANGLE_OPEN = '<',
    ANGLE_CLOSE = '>',
    SLASH = '/',
    QUOTE = `' or "`,
}

export type Token = {
    kind: TokenKind;
    value: string;
    afterWhitespace: boolean;
    pos: Position;
    end?: Position;
};

export interface Attribute extends AstNode {
    kind: 'htmlAttribute';
    name: string;
    value?: string;
}
export interface HtmlElement extends AstNode {
    attributes?: Attribute[];
    content?: string;
    selfClosing: boolean;
}
export interface EmbeddedLanguage extends AstNode {
    name: string;
    kind: 'language';
    attributeValue: boolean;
}

export interface AstNode {
    name: string;
    kind: 'tree' | 'element' | 'language' | 'openTag' | 'closeTag' | 'errorNode' | 'htmlAttribute';
    children?: AstNode[];
    loc: Location;
}

export interface ErrorNode extends AstNode {
    kind: 'errorNode';
    message: string;
}

export type Tree = {
    kind: 'tree';
    children: Array<AstNode | Program>;
    errors: Array<ErrorNode>;
};

export function newAstTree(children: Array<AstNode | Program> = [], errors: Array<ErrorNode> = []): Tree {
    return { kind: 'tree', children, errors };
}

