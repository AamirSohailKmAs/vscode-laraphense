'use strict';

import { Token, Tokenizer } from './tokenizer';

export enum TokenKind {
    Php = 'Php',
    Html = 'Html',
    Css = 'Css',
    Js = 'Js',

    NAME = 'name',
    RESERVED_KEYWORDS = 'RESERVED_KEYWORDS',
    WHITESPACE = 'whitespace', // \s
    NEW_LINE = 'new_line', // \n
    CARRIAGE_RETURN = 'carriage_return', // \r
    TAB = 'tab', // \t
    SOF = 'sof', // start of file
    EOF = 'eof', // end of file
    UNRECOGNIZED = 'unrecognized', //

    PHP_TAG_START = 'PHP_TAG_START', // <?php
    PHP_TAG_END = 'PHP_TAG_END', // ?>
    PHP_ECHO_START = 'PHP_ECHO_START', // <?=
    BLADE_COMMENT_START = 'BLADE_COMMENT_START', // {{--
    BLADE_COMMENT_END = 'BLADE_COMMENT_END', // --}}
    BLADE_RAW_END = 'BLADE_RAW_END', // !!}
    BLADE_RAW_START = 'BLADE_RAW_START', // {!!
    BLADE_ECHO_START = 'BLADE_ECHO_START', // {{
    BLADE_ECHO_END = 'BLADE_ECHO_END', // }}

    EQUAL = 'EQUAL', // =
    NOT = 'NOT', // !
    ANGLE_OPEN = 'ANGLE_OPEN', // <
    ANGLE_CLOSE = 'ANGLE_CLOSE', // >
    FORWARD_SLASH = 'FORWARD_SLASH', // /
    AT = 'AT', // @
    DOUBLE_QUOTE = 'DOUBLE_QUOTE', // '
    SINGLE_QUOTE = 'SINGLE_QUOTE', // "
    CLOSE_PAREN = 'CLOSE_PAREN', // )
    CLOSE_BRACE = 'CLOSE_BRACE', // }
    OPEN_PAREN = 'OPEN_PAREN', // (
    OPEN_BRACE = 'OPEN_BRACE', // {
    STRING = 'STRING', // 'abc'
    COMMENT = 'COMMENT',
    BLADE_COMMENT = 'BLADE_COMMENT',
}

export enum LexerState {
    AfterAttributeName = 'AfterAttributeName',
    AfterOpeningStartTag = 'AfterOpeningStartTag',
    BeforeAttributeValue = 'BeforeAttributeValue',
    WithinContent = 'WithinContent',
    WithinTag = 'WithinTag',
    WithinEndTag = 'WithinEndTag',
    WithinScript = 'WithinScript',
}

const whitespaces: Record<string, TokenKind> = {
    ' ': TokenKind.WHITESPACE,
    '\n': TokenKind.NEW_LINE,
    '\r': TokenKind.CARRIAGE_RETURN,
    '\t': TokenKind.TAB,
};

const startSymbols: Record<string, TokenKind> = {
    '{{--': TokenKind.BLADE_COMMENT_START,
    '{!!': TokenKind.BLADE_RAW_START,
    '{{': TokenKind.BLADE_ECHO_START,
    '<?php': TokenKind.PHP_TAG_START,
    '<?=': TokenKind.PHP_ECHO_START,
    '@': TokenKind.AT,
    '<': TokenKind.ANGLE_OPEN,
};

const symbols: Record<string, TokenKind> = {
    '{{--': TokenKind.BLADE_COMMENT_START,
    '--}}': TokenKind.BLADE_COMMENT_END,
    '!!}': TokenKind.BLADE_RAW_END,
    '{!!': TokenKind.BLADE_RAW_START,
    '{{': TokenKind.BLADE_ECHO_START,
    '}}': TokenKind.BLADE_ECHO_END,
    '<?php': TokenKind.PHP_TAG_START,
    '<?=': TokenKind.PHP_ECHO_START,
    '?>': TokenKind.PHP_TAG_END,
    '@': TokenKind.AT,
    '=': TokenKind.EQUAL,
    '!': TokenKind.NOT,
    '<': TokenKind.ANGLE_OPEN,
    '>': TokenKind.ANGLE_CLOSE,
    '/': TokenKind.FORWARD_SLASH,
    '"': TokenKind.DOUBLE_QUOTE,
    "'": TokenKind.SINGLE_QUOTE,
    ')': TokenKind.CLOSE_PAREN,
    '(': TokenKind.OPEN_PAREN,
};

type triviaData = {
    lastSkipped: boolean;
    text: string;
};
export class Lexer {
    private _tokenizer: Tokenizer<TokenKind, triviaData>;
    private _tokens: Token<TokenKind>[] = [];
    private _token: Token<TokenKind, triviaData>;
    private _index: number = 0;
    private _endOfFileIndex: number = 0;
    private _code: string = '';
    private _lastTagName = '';
    private _lastAttributeName = '';
    private _state: LexerState = LexerState.WithinContent;

    constructor() {
        this._tokenizer = new Tokenizer<TokenKind, triviaData>(
            [
                { regex: /^[\s\r\t\n]/, tokenMap: whitespaces },
                { regex: /^<!--[\s\S]*?-->/, tokenMap: {}, kind: TokenKind.COMMENT },
                { regex: Tokenizer.buildRegexFromSpecialCharacters(Object.keys(symbols), '^'), tokenMap: symbols },
                { regex: /^[_:\w][_:\w-.\d]*/, tokenMap: {}, kind: TokenKind.NAME },
            ],
            [TokenKind.NEW_LINE, TokenKind.CARRIAGE_RETURN, TokenKind.TAB, TokenKind.WHITESPACE],
            TokenKind.EOF,
            TokenKind.UNRECOGNIZED,
            (token: Token<TokenKind>, tokenizer: Tokenizer<TokenKind, triviaData>) => {
                let text = '';
                if (token.kind === TokenKind.NAME) {
                    text = token.getText(tokenizer.code);
                }
                return {
                    lastSkipped: tokenizer.lastSkipped !== null,
                    text,
                };
            }
        );
        this._token = new Token<TokenKind, triviaData>(TokenKind.SOF, 0, 0);
    }

    public init(code: string): void {
        this._code = code;
        this._tokenizer.setInput(code);

        this._switchState();
        while (TokenKind.EOF !== this._token.kind) {
            this._tokens.push((this._token = this._tokenizer.nextToken()));

            if (this._token.kind === TokenKind.UNRECOGNIZED) {
                // just get rid of this token
                this._tokens.pop();
            }

            this._switchState();
        }

        this._endOfFileIndex = this._tokens.length - 1;
    }

    private _switchState() {
        switch (this._state) {
            case LexerState.WithinContent:
                return this._lexWithinContent();
            case LexerState.AfterOpeningStartTag:
                return this._lexAfterOpeningStartTag();
            case LexerState.WithinTag:
                return this._lexWithinTag();
            case LexerState.WithinEndTag:
                return this._lexWithinEndTag();
            case LexerState.AfterAttributeName:
                return this._lexAfterAttributeName();
            case LexerState.BeforeAttributeValue:
                return this._lexBeforeAttributeValue();
            case LexerState.WithinScript:
                return this._lexWithinScript();
        }
    }
    private _lexWithinScript() {
        // see http://stackoverflow.com/questions/14574471/how-do-browsers-parse-a-script-tag-exactly

        let scriptState = 1;
        while (!this._tokenizer.isEndOfFile()) {
            const match = this._tokenizer.advanceIfRegex(/<!--|-->|<\/?script\s*\/?>?/i, false);
            console.log(match);

            if (match.length === 0) {
                this._tokenizer.setOffset(this._code.length);
                this._tokens.push(
                    (this._token = this.newToken(
                        TokenKind.Js,
                        this._code.length - this._getStartFromToken(this._token)
                    ))
                );
                // break;
                return;
            } else if (match === '<!--') {
                if (scriptState === 1) {
                    scriptState = 2;
                }
            } else if (match === '-->') {
                scriptState = 1;
            } else if (match[1] !== '/') {
                // <script
                if (scriptState === 2) {
                    scriptState = 3;
                }
            } else {
                // </script
                if (scriptState === 3) {
                    scriptState = 2;
                } else {
                    // to the beginning of the closing tag
                    break;
                }
            }
        }
        this._state = LexerState.WithinContent;
    }

    private _lexWithinEndTag() {
        this._state = LexerState.WithinContent;

        if (this._token.kind === TokenKind.NAME) {
            if (this._token.getText(this._code) !== this._lastTagName) {
                // add warning in parser,
                // <kmas:slot></kmas> this should not trigger warning
            }
            return;
        }

        this._tokenizer.advanceUntilRegex(/>/);
    }

    private _lexBeforeAttributeValue() {
        if ([TokenKind.SINGLE_QUOTE, TokenKind.DOUBLE_QUOTE].includes(this._token.kind)) {
            // "foo bar {{ $kmas }} @if($buzz->isTrue()) bla bla @endif"
            // @ and {{ }} can exists in attributeValue
            const quote = TokenKind.SINGLE_QUOTE === this._token.kind ? "'" : '"';

            const length = this._tokenizer.advanceUntilRegex(new RegExp(`${quote}`));

            this._tokens.push(this.newToken(TokenKind.STRING, length, true));
            this._tokens.push((this._token = this._tokenizer.nextToken()));
            this._state = LexerState.WithinTag;
            return;
        }
        // let attributeValue = stream.advanceIfRegex(/^[^\s"'`=<>]+/);
        // if (attributeValue.length > 0) {
        //     if (stream.peekChar() === _RAN && stream.peekChar(-1) === _FORWARD_SLASH) {
        //         // <foo bar=http://foo/>
        //         stream.goBack(1);
        //         attributeValue = attributeValue.substring(0, attributeValue.length - 1);
        //     }

        //     if (attributeValue.length > 0) {
        //         this._state = LexerState.WithinTag;
        //         hasSpaceAfterTag = false;
        //         return finishToken(offset, TokenType.AttributeValue);
        //     }
        // }
        this._state = LexerState.WithinTag;
    }

    private _lexAfterAttributeName() {
        if (this._token.kind === TokenKind.EQUAL) {
            this._state = LexerState.BeforeAttributeValue;
            return;
        }

        this._state = LexerState.WithinTag;
    }

    /**
     * Possible blade states are <?php, <?=, {{, {!!, {{--, and at states
     */
    private _bladeStates() {
        if ([TokenKind.PHP_TAG_START, TokenKind.PHP_ECHO_START].includes(this._token.kind)) {
            const length = this._tokenizer.advanceUntilRegex(/\?>/);
            this._tokens.push(this.newToken(TokenKind.Php, length));

            this._tokens.push((this._token = this._tokenizer.nextToken()));
            return true;
        }

        if ([TokenKind.BLADE_ECHO_START].includes(this._token.kind)) {
            const length = this._tokenizer.advanceUntilRegex(/}}/);
            this._tokens.push(this.newToken(TokenKind.Php, length));

            this._tokens.push((this._token = this._tokenizer.nextToken()));
            return true;
        }

        if ([TokenKind.BLADE_RAW_START].includes(this._token.kind)) {
            const length = this._tokenizer.advanceUntilRegex(/!!}/);
            this._tokens.push(this.newToken(TokenKind.Php, length));

            this._tokens.push((this._token = this._tokenizer.nextToken()));
            return true;
        }

        if ([TokenKind.BLADE_COMMENT_START].includes(this._token.kind)) {
            const length = this._tokenizer.advanceUntilRegex(/--}}/);
            this._tokens.push(this.newToken(TokenKind.BLADE_COMMENT, length));

            this._tokens.push((this._token = this._tokenizer.nextToken()));

            return true;
        }

        return this._atStates();
    }
    /**
     * Possible at states are @valid(), @{{, @@if, @php @endphp, @verbatim @endverbatim
     */
    private _atStates(): boolean {
        if (this._token.kind === TokenKind.AT) {
            // @
            // this._tokens.push(this._token);
            this._token = this._tokenizer.nextToken();
            if (this._token.triviaData?.lastSkipped) {
                // @

                this._tokens.pop();
                return false;
            }
            if (TokenKind.NAME === this._token.kind) {
                // php, if, verbatim
                this._tokens.push(this._token);

                if (this._token.getText(this._code).toLowerCase() === 'verbatim') {
                    // @verbatim
                    // this._state = LexerState.WithinVerbatimContent;
                    const length = this._tokenizer.advanceUntilRegex(/@endverbatim/);
                    // what if @endverbatim is missing, then @verbatim is just a text
                    this._tokens.push(this.newToken(TokenKind.Html, length));

                    this._tokens.push((this._token = this._tokenizer.nextToken())); // @endverbatim
                    return true;
                }

                if (this._token.getText(this._code).toLowerCase() === 'php') {
                    // @php

                    if (this._tokenizer.peekToken().kind === TokenKind.OPEN_PAREN) {
                        // @php(
                        this._tokens.push((this._token = this._tokenizer.nextToken())); // (
                        this._lexParenthesesContent(TokenKind.Php);
                        return true;
                    } else {
                        const length = this._tokenizer.advanceUntilRegex(/@endphp/);
                        this._tokens.push(this.newToken(TokenKind.Php, length));

                        this._tokens.push((this._token = this._tokenizer.nextToken())); // @endphp
                    }
                    return true;
                }

                // todo check when call for attribute
                if (this._tokenizer.peekToken().kind === TokenKind.EQUAL) {
                    // @click= maybe alpinejs
                    return false;
                }

                if (TokenKind.OPEN_PAREN === this._tokenizer.peekToken().kind) {
                    // (
                    this._tokens.push((this._token = this._tokenizer.nextToken())); // (
                    this._lexParenthesesContent(TokenKind.Php);
                    return true;
                }
            }
            // if (this._token.kind === TokenKind.AT) {
            //     // @@, e.g. @@if()
            //     // this._token = this._tokenizer.nextToken();
            //     // this._tokens.pop();
            //     // return false;
            // }

            // if (this._token.kind === TokenKind.BLADE_ECHO_START) {
            //     // @{{
            //     // this._tokenizer.advanceUntilRegex(/}}/);
            //     // this._token = this._tokenizer.nextToken();
            //     // todo use proper function to advance until }} but take care of internal scan for validity
            //     // this._state = LexerState.WithinBladeEchoContent;
            //     // return false;
            // }
            // if (this._token.kind === TokenKind.BLADE_RAW_START) {
            //     // @{!!
            //     // this._tokenizer.advanceUntilRegex(/!!}/);
            //     // this._token = this._tokenizer.nextToken();
            //     // todo use proper function to advance until !!} but take care of internal scan for validity
            //     // this._state = LexerState.WithinBladeEchoContent;
            //     // return false;
            // }

            if (this._token.kind === TokenKind.AT) {
                this._tokens.pop();
                // maybe we need to advance back
            }
        }

        return false;
    }

    /**
     * function for tokenizer, tokenizer cursor must be on (
     */
    private _lexParenthesesContent(kind: TokenKind) {
        let length = 0;
        let depth = 1;

        if (TokenKind.OPEN_PAREN !== this._token.kind) {
            return;
        }

        let token = this._token;

        while (depth > 0) {
            length += this._tokenizer.advanceUntilRegex(/\(|\)+/);
            token = this._tokenizer.peekToken();
            if (token.kind === TokenKind.OPEN_PAREN) {
                token = this._tokenizer.nextToken();
                depth++;
                length++;
            }
            if (token.kind === TokenKind.CLOSE_PAREN) {
                depth--;
                length++;
                if (depth > 0) {
                    token = this._tokenizer.nextToken();
                }
            }
        }

        this._tokens.push(this.newToken(kind, length - 1));
    }

    private _lexWithinContent() {
        if (this._bladeStates()) {
            return;
        }

        if ([TokenKind.ANGLE_OPEN].includes(this._token.kind)) {
            // <
            const nextToken = this._tokenizer.peekToken();
            if ([TokenKind.NAME].includes(nextToken.kind) && !nextToken.triviaData?.lastSkipped) {
                this._state = LexerState.AfterOpeningStartTag;
                return;
            }

            if ([TokenKind.FORWARD_SLASH].includes(nextToken.kind)) {
                // /
                this._state = LexerState.WithinEndTag;
                return;
            }

            this._tokens.pop();
        }

        // very important regex
        this._tokenizer.advanceUntilRegex(Tokenizer.buildRegexFromSpecialCharacters(Object.keys(startSymbols)));
    }

    private _lexAfterOpeningStartTag() {
        if (this._token.kind === TokenKind.NAME && !this._token.triviaData?.lastSkipped) {
            this._lastTagName = this._token.triviaData?.text ?? '';
            this._state = LexerState.WithinTag;
            return;
        }

        // maybe we are in text so remove the last token, it will add in state change loop and then checked within content
        // this._tokens.pop();
        this._state = LexerState.WithinContent;
    }

    private _lexWithinTag() {
        if (TokenKind.NAME === this._token.kind && this._token.triviaData?.lastSkipped) {
            this._lastAttributeName = this._token.getText(this._code);
            this._state = LexerState.AfterAttributeName;
            return;
        }

        if (TokenKind.ANGLE_CLOSE === this._token.kind) {
            // >
            if (this._lastTagName === 'script') {
                this._state = LexerState.WithinScript;
                return;
            }
            if (this._lastTagName === 'style') {
                const length = this._tokenizer.advanceUntilRegex(/<\/style/i);
                this._tokens.push(this.newToken(TokenKind.Css, length));
                // this._state = LexerState.WithinContent;
                return;
            }
            this._state = LexerState.WithinContent;
            return;
        }

        if (this._bladeStates()) {
            return;
        }

        if (this._token.kind === TokenKind.FORWARD_SLASH) {
            const peek = this._tokenizer.peekToken();
            if (peek.kind === TokenKind.CLOSE_BRACE && !peek.triviaData?.lastSkipped) {
                // />
                this._tokens.push((this._token = this._tokenizer.nextToken()));
                this._state = LexerState.WithinContent;
                return;
            }
        }

        // if (TokenKind.ANGLE_OPEN === this._tokenizer.peekToken().kind) {
        //     // <
        //     this._state = LexerState.WithinContent;
        //     return;
        //     // Closing bracket missing.;
        // }
    }

    /**
     * setOffset
     */
    public newToken(kind: TokenKind, length: number, triviaData: boolean = true, currentToken?: Token<TokenKind>) {
        const token = new Token<TokenKind, triviaData>(
            kind,
            this._getStartFromToken(currentToken ?? this._token),
            length
        );
        if (triviaData) {
            token.triviaData = { lastSkipped: false, text: token.getText(this._code) };
        }
        return token;
    }

    private _getStartFromToken(token: Token<TokenKind>) {
        return token.start + token.length;
    }

    public peek(n: number = 1): Token<TokenKind> {
        const index = this._index + n;
        if (index >= this._endOfFileIndex) {
            return this._tokens[this._endOfFileIndex];
        }
        return this._tokens[index];
    }

    public nextToken(): Token<TokenKind> {
        const token = this.peek();

        this._index++;
        return token;
    }
}

