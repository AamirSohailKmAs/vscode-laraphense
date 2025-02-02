'use strict';

import { Engine, Program } from 'php-parser';

import {
    AstNode,
    Attribute,
    EmbeddedLanguage,
    HtmlElement,
    Location,
    Token,
    TokenKind,
    Tree,
    newAstTree,
} from './bladeAst';
import { BladeLexer } from './lexer';

type config = {
    parser: {
        extractDoc: boolean;
        suppressErrors: boolean;
        version: number; // or '7.4' or 704
    };
    ast: {
        withPositions: boolean;
    };
    lexer: {
        short_tags: boolean;
    };
};

export class BladeParser {
    public phpParser: Engine;

    private tokens: Token[] = [];
    private index: number = 0;
    private tree: Tree = { kind: 'tree', children: [], errors: [] };
    private inVerbatim = false;
    private _config: config;

    constructor(version: number = 820, extractDoc: boolean = true, suppressErrors: boolean = true) {
        this._config = {
            parser: { version, extractDoc, suppressErrors },
            ast: { withPositions: true },
            lexer: { short_tags: true },
        };
        this.phpParser = new Engine(this._config);
    }

    public parse(doc: string, languageId: 'blade' | 'php'): Tree {
        if (languageId === 'php') {
            return newAstTree([this.phpParser.parseCode(doc, languageId)]);
        }
        return this._parseTree(doc);
    }

    private _parseTree(doc: string) {
        this.index = 0;
        this.tree = newAstTree();

        this.tokens = new BladeLexer(doc).lex();

        while (this.index < this.tokens.length) {
            const node = this.parseNextNode();
            if (node) {
                this.tree.children.push(node);
            }
        }

        return this.tree;
    }

    private parseProgram(): Program {
        const program = this.phpParser.parseEval(this.token().value);
        // todo: fix location
        return program;
    }

    private token(index?: number) {
        if (index && index > this.tokens.length - 1) {
            index = this.tokens.length - 1;
        }

        index = index ?? this.index;

        return this.tokens[index];
    }

    private is(expectedKind: TokenKind): boolean {
        return this.token().kind === expectedKind;
    }

    private in(expectedKinds: TokenKind[]): boolean {
        return expectedKinds.includes(this.token().kind);
    }

    private eat(upto: number = 1): Token {
        const token = this.token();
        this.index += upto;
        return token;
    }

    private addError(message: string, loc: Location) {
        if (this._config.parser.suppressErrors) {
            this.tree.errors.push({
                name: 'Syntax Error',
                kind: 'errorNode',
                message,
                loc,
            });
        } else {
            throw new SyntaxError(message);
        }
    }

    private expect(expectedKind: TokenKind): Token | undefined {
        if (this.is(expectedKind)) {
            return this.eat();
        }

        const token = this.token();

        const end = { ...token.pos };
        end.offset += token.value.length;
        end.character += token.value.length;

        const found = token.value.length < 11 ? token.value : token.value.substring(0, 10) + '...';

        this.addError(`Expected '${expectedKind}', but got '${found}'`, { start: token.pos, end });
        return undefined;
    }

    private expectIf(condition: boolean, expectedKind: TokenKind): Token | undefined {
        if (!condition) {
            return undefined;
        }
        return this.expect(expectedKind);
    }

    private peekUntil(breakAt: (token: Token) => boolean): Token {
        const index = this.index++;
        let token = this.eatUntil(breakAt);
        this.index = index;

        return token;
    }

    private eatUntil(breakAt: (token: Token) => boolean, recoverAt?: (token: Token) => boolean): Token {
        const index = this.index++;
        let token = this.token();
        while (!this.is(TokenKind.EOF)) {
            if (breakAt(token)) break;
            token = this.token();
            this.index++;
        }

        if (recoverAt && this.is(TokenKind.EOF)) {
            this.index = index;
            return this.eatUntil(recoverAt);
        }

        return token;
    }

    private parseLang(): null {
        if (this.inVerbatim && this.is(TokenKind.PHP)) {
            this.index++;
            return null;
        }

        if (this.is(TokenKind.PHP)) {
            this.tree.children.push(this.parseProgram());
            this.index++;
            return null;
        }

        const start = this.token().pos;
        const end = this.token().end ?? this.token(this.index + 1).pos;
        end.character -= 1;
        end.offset -= 1;
        const node: EmbeddedLanguage = {
            kind: 'language',
            name: this.token().kind,
            loc: { start, end: { ...end } },
            attributeValue: false,
        };
        this.index++;
        this.tree.children.push(node);
        return null;
    }

    private parseBlade(): null {
        this.token();
        this.index++; // skip {{, {{--, {!!
        if (this.is(TokenKind.PHP)) {
            this.parseLang();
        }

        if (
            [TokenKind.BLADE_ECHO_END, TokenKind.BLADE_COMMENT_END, TokenKind.BLADE_RAW_END].includes(this.token().kind)
        ) {
            this.index++;
        }

        return null;
    }

    private parseDirective(): AstNode | null {
        // what if @endverbatim is missing, then @verbatim is just a text
        if (this.token().value.toLowerCase() === 'verbatim') {
            const peekToken = this.peekUntil(
                (token) => token.kind === TokenKind.DIRECTIVE && token.value.toLowerCase() === 'endverbatim'
            );

            if (peekToken.kind === TokenKind.DIRECTIVE && peekToken.value.toLowerCase() === 'endverbatim') {
                this.inVerbatim = true;
            }
        }
        if (this.token().value.toLowerCase() === 'endverbatim') {
            this.inVerbatim = false;
        }

        this.index++;
        if (this.is(TokenKind.PHP)) {
            this.parseLang();
        }

        return null;
    }

    private parseAttributes() {
        const attributes: Attribute[] = [];
        while (
            this.in([
                TokenKind.ATTRIBUTE,
                TokenKind.DIRECTIVE,
                TokenKind.BLADE_ECHO_START,
                TokenKind.BLADE_RAW_START,
                TokenKind.BLADE_COMMENT_START,
            ])
        ) {
            if (this.is(TokenKind.DIRECTIVE)) {
                this.parseDirective();
            }
            if (this.in([TokenKind.BLADE_ECHO_START, TokenKind.BLADE_RAW_START, TokenKind.BLADE_COMMENT_START])) {
                this.parseBlade();
            }
            if (this.is(TokenKind.ATTRIBUTE)) {
                const attributeNameToken = this.eat();
                const attributeName = attributeNameToken.value;
                let end = { ...attributeNameToken.pos };
                end.offset += attributeName.length;
                end.character += attributeName.length;

                let attributeValue: string | undefined = undefined;
                if (this.is(TokenKind.EQUAL)) {
                    this.eat();
                    let hasQuote = false;
                    if (this.is(TokenKind.QUOTE)) {
                        this.eat();
                        hasQuote = true;
                    }
                    // <foo attribute=@if($condition) test @else testing @endif>
                    // <foo attribute=@if($condition) {{ $value }} @endif>
                    if (!hasQuote && this.is(TokenKind.DIRECTIVE)) {
                        this.parseDirective();
                        // it not good to continue but fine for now
                        continue;
                    }
                    // <foo action={{ 'https://' . $pfHost . '/eng/process' }}>
                    if (
                        !hasQuote &&
                        this.in([TokenKind.BLADE_ECHO_START, TokenKind.BLADE_RAW_START, TokenKind.BLADE_COMMENT_START])
                    ) {
                        this.parseBlade();
                        // it not good to continue but fine for now
                        continue;
                    }

                    const attributeValueToken = this.expect(TokenKind.ATTRIBUTE_VALUE);
                    this.expectIf(hasQuote, TokenKind.QUOTE);
                    if (attributeValueToken) {
                        // set attribute languages here

                        if (getAttributeLanguage(attributeName)) {
                            // todo: parse language
                        }
                        attributeValue = attributeValueToken.value;
                        end = attributeValueToken.pos;
                    }
                }

                attributes.push({
                    name: attributeName,
                    value: attributeValue,
                    kind: 'htmlAttribute',
                    loc: {
                        start: attributeNameToken.pos,
                        end,
                    },
                });
            }
        }

        return attributes;
    }

    private parseHtmlOpenTag(): HtmlElement {
        let selfClosing = false;
        const start = this.token().pos;

        this.expect(TokenKind.ANGLE_OPEN);
        const name = this.eat().value;

        const attributes = this.parseAttributes();

        if (this.is(TokenKind.SLASH)) {
            selfClosing = true;
            this.expect(TokenKind.SLASH);
        }

        this.expect(TokenKind.ANGLE_CLOSE);

        const end = this.token().pos;

        const openTag: HtmlElement = {
            name,
            kind: 'openTag',
            attributes,
            selfClosing,
            loc: { start, end },
        };
        return openTag;
    }

    private parseCloseTag(): AstNode | null {
        this.eat(2); // </
        const tagName = this.expect(TokenKind.TAG_NAME);
        if (!tagName) {
            return null;
        }
        this.expect(TokenKind.ANGLE_CLOSE);
        const end = { ...tagName.pos };
        end.offset += tagName.value.length;
        end.character += tagName.value.length;
        return { kind: 'closeTag', loc: { start: tagName.pos, end }, name: tagName.value };
    }

    private parseHtmlElement(): AstNode {
        const openTag = this.parseHtmlOpenTag();

        if (openTag.selfClosing) {
            openTag.kind = 'element';
            return openTag;
        }

        const children: AstNode[] = [];
        while (!this.is(TokenKind.EOF)) {
            const node = this.parseNextNode();
            if (node && 'name' in node) {
                if (node.kind === 'closeTag' && node.name.toLowerCase() === openTag.name.toLowerCase()) {
                    // todo: <slot:foo></slot>
                    break;
                }
                children.push(node);
            }
        }

        const end = this.token(this.index - 1).pos;

        const htmlElementNode: HtmlElement = {
            name: openTag.name,
            kind: 'element',
            selfClosing: false,
            loc: { start: openTag.loc.start, end },
            attributes: openTag.attributes,
        };

        if (children.length > 0) {
            htmlElementNode.children = children;
        }

        return htmlElementNode;
    }

    private parseNextNode(): AstNode | Program | null {
        if (this.index >= this.tokens.length) {
            return null;
        }

        const token = this.token();

        // this <{{ $tagName }} attribute="value"> is possible case but we'll not support this syntax
        // this <foo bar="something{{buzz}}" > is possible case
        // this <foo bar="@if(true) {{ $bar }} @endif"> is possible case

        // tag name regex, /^[_:\w][_:\w-.\d]*/
        // attribute regex, /^[^\s"'></=\x00-\x0F\x7F\x80-\x9F]*/
        switch (token.kind) {
            case TokenKind.TEXT:
                this.index++;
                return null;
            case TokenKind.DIRECTIVE:
                return this.parseDirective();
            case TokenKind.ANGLE_OPEN:
                if (this.token(this.index + 1).kind === TokenKind.SLASH) {
                    return this.parseCloseTag();
                }
                return this.parseHtmlElement();
            case TokenKind.PHP:
            case TokenKind.CSS:
            case TokenKind.HTML:
            case TokenKind.JS:
                return this.parseLang();
            case TokenKind.BLADE_ECHO_START:
            case TokenKind.BLADE_RAW_START:
            case TokenKind.BLADE_COMMENT_START:
                return this.parseBlade();
            default:
                this.index++;
                return null;
        }
    }
}

function getAttributeLanguage(attributeName: string) {
    const match = attributeName.match(/^(style)$|^(on\w+)$/i);
    if (!match) {
        return null;
    }
    return match[1] ? 'css' : 'js';
}

