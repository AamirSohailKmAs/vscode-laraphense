'use strict';

import { Engine } from 'php-parser';

import { AstNode, Attribute, EmbeddedLanguage, HtmlElement, Location, Token, TokenKind, Tree } from '../types/bladeAst';
import { DocLang } from '../laraphense/document';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { BladeLexer } from './lexer';
import { toDocLang } from '../helpers/uri';

export type parserConfig = {
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
    private _doc: TextDocument;

    private tokens: Token[] = [];
    private index: number = 0;
    private tree: Tree = { kind: 'tree', children: [], errors: [] };

    constructor(private _config: parserConfig) {
        this.phpParser = new Engine(this._config);
        this._doc = TextDocument.create('init', DocLang.unknown, 1, '');
    }

    public parse(doc: TextDocument, languageId: DocLang.blade | DocLang.php): Tree {
        this._doc = doc;
        if (languageId === DocLang.php) {
            return { kind: 'tree', children: [this.phpParser.parseCode(doc.getText(), languageId)], errors: [] };
        }
        return this._parseTree();
    }

    public justAstTree(): Tree {
        return { kind: 'tree', children: [], errors: [] };
    }

    private _parseTree() {
        this.index = 0;
        this.tree = this.justAstTree();

        this.tokens = new BladeLexer(this._doc.getText()).lex();

        while (this.index < this.tokens.length) {
            const node = this.parseNextNode();
            if (node) {
                this.tree.children.push(node);
            }
        }

        return this.tree;
    }

    // private parseProgram(token: Token): Program {
    //     const program = this.phpParser.parseEval(token.value);
    //     // todo: fix location
    //     return program;
    // }

    private token(index?: number) {
        if (index && index > this.tokens.length - 1) {
            index = this.tokens.length - 1;
        }

        index = index ?? this.index;

        return this.tokens[index];
    }

    private is(expectedType: TokenKind): boolean {
        return this.token().kind === expectedType;
    }

    private eat(upto: number = 1): Token {
        const token = this.token();
        this.index += upto;
        return token;
    }

    private addError(message: string, loc: Location) {
        if (this._config.parser.suppressErrors) {
            this.tree.errors.push({
                name: 'error',
                kind: 'errorNode',
                message,
                loc,
            });
        } else {
            throw new SyntaxError(message);
        }
    }

    private expect(expectedType: TokenKind): Token | undefined {
        if (this.is(expectedType)) {
            return this.eat();
        }

        const token = this.token();
        console.log(token);

        const end = { ...token.pos };
        end.offset += token.value.length;
        end.character += token.value.length;

        this.addError(`Expected '${expectedType}', but got '${token.kind}'`, { start: token.pos, end });
        return undefined;
    }

    private expectIf(condition: boolean, expectedType: TokenKind): Token | undefined {
        if (!condition) {
            return undefined;
        }
        return this.expect(expectedType);
    }

    // private readUntil(targetTokenKind: TokenKind): Token {
    //     let token = this.token();
    //     while (this.token().kind !== targetTokenKind && this.token().kind !== TokenKind.EOF) {
    //         token = this.token();
    //         this.index++;
    //     }

    //     return token;
    // }

    private parseLang(): null {
        const start = this.token().pos;
        const end = this.token().end ?? this.token(this.index + 1).pos;
        end.character -= 1;
        end.offset -= 1;
        const node: EmbeddedLanguage = {
            kind: 'language',
            name: toDocLang(this.token().kind),
            loc: { start, end: { ...end } },
            attributeValue: false,
        };
        this.index++;
        this.tree.children.push(node);
        return null;
    }

    private parseDirective(): AstNode | null {
        // what if @endverbatim is missing, then @verbatim is just a text

        this.index++;
        return null;
    }

    private parseAttributes() {
        const attributes: Attribute[] = [];
        while (this.is(TokenKind.ATTRIBUTE)) {
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
                const attributeValueToken = this.expect(TokenKind.ATTRIBUTE_VALUE);
                this.expectIf(hasQuote, TokenKind.QUOTE);
                if (attributeValueToken) {
                    // set attribute languages here
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
            if (node) {
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

    private parseNextNode(): AstNode | null {
        if (this.index >= this.tokens.length) {
            return null;
        }

        const token = this.token();

        // this <{{ $foo }}> is possible case
        // this <foo {{ $bar }}> is possible case
        // this <foo bar="something{{buzz}}" > is possible case
        // this <foo bar="@if(true) {{ $bar }} @endif"> is possible case
        // this <foo @if(true) {{ $bar }} @endif> is possible case

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
            default:
                this.index++;
                return null;
        }
    }
}

