'use strict';

import { Position, Token, TokenKind } from '../types/bladeAst';

enum State {
    Text,
    Css,
    Js,
    Php,
    HtmlComment,
    CloseTag,
    OpenTag,
    WithInOpenTag,
    WithInAttribute,
    At,
    BladeEcho,
    BladeRaw,
    BladeComment,
}

export class BladeLexer {
    private input: string = '';
    private index: number = 0;
    private currentChar: string | null = null;
    private lastWhitespace: boolean = false;
    private line: number = 1; // Initialize line number
    private character: number = 1; // Initialize character within the line
    private tokens: Token[] = [];
    private state: State = State.Text;
    private lastState: State = State.Text;
    private lastTagName: string = '';
    private lastDirectiveName: string = '';

    constructor(input: string) {
        this.input = input;
        this.index = 0;
        this.currentChar = this.input[0] || null;
    }

    private setState(state: State) {
        this.lastState = this.state;
        this.state = state;
        return true;
    }

    private setLastState() {
        const state = this.state;
        this.state = this.lastState;
        this.lastState = state;
    }

    private advance(n: number = 1) {
        this.index += n;
        this.currentChar = this.input[this.index] || null;
        this.character += n;
        return this;
    }

    private pos(offset?: number): Position {
        offset = offset ?? this.index;
        return { offset, line: this.line, character: this.character };
    }

    private isWhitespace(char: string | null): boolean {
        return /\s/.test(char || '');
    }

    private isAlpha(char: string | null): boolean {
        return /[a-zA-Z]/.test(char || '');
    }

    private isWord(word: string) {
        for (let i = 0; i < word.length; i++) {
            if (this.input[this.index + i] !== word[i]) {
                return false;
            }
        }
        return true;
    }

    private isChar(character: string) {
        return this.currentChar === character;
    }

    private readUntil(breakAt: (char: string) => boolean, recoverAt?: (char: string) => boolean): string {
        let result = '';
        const index = this.index;
        const line = this.line;
        const character = this.character;

        while (this.currentChar !== null) {
            if (breakAt(this.currentChar)) break;
            result += this.currentChar;
            if (['\n', '\r'].includes(this.currentChar)) {
                this.line++;
                this.character = 0;
            }
            this.advance();
        }

        if (this.currentChar === null && recoverAt) {
            this.index = index;
            this.line = line;
            this.character = character;
            this.currentChar = this.input[this.index] || null;
            result = this.readUntil(recoverAt);
        }

        return result;
    }

    private lexAt() {
        // pending =>  @verbatim @endverbatim

        // fixed => @valid(), @if ($condition), @php(), @php @endphp, kmas@gmail.com, @submit.prevent, @custom-event.window=""

        let withoutPara = true;

        this.advance(); // Skip the '@'
        const pos = this.pos();
        const value = this.readUntil((char) => !(['.', '-'].includes(char) || this.isAlpha(char)));
        this.lastDirectiveName = value;
        this.addToken(TokenKind.DIRECTIVE, value, pos);
        this.skipWhitespaces();
        if (this.isChar('(')) {
            withoutPara = false;
            this.advance(); // Skip the '('
            const pos = this.pos();
            const value = this.lexParenthesesContent();

            this.addToken(TokenKind.PHP, value, pos, this.pos(this.index - 1));
        }

        if (withoutPara && this.lastDirectiveName.toLowerCase() === 'php') {
            const pos = this.pos();
            const value = this.readUntil(
                (char) => char === '@' && this.isWord('@endphp'),
                (_char) => true
            );
            if (value) {
                this.addToken(TokenKind.PHP, value, pos, this.pos(this.index - 1));
            }
        }
        return this.setLastState();
    }

    private lexParenthesesContent() {
        let depth = 1;
        let value = '';

        while (depth > 0) {
            value += this.readUntil((char) => ['(', ')'].includes(char));
            if (this.isChar('(')) {
                this.advance();
                value += '(';
                depth++;
            }
            if (this.isChar(')')) {
                this.advance();
                if (--depth === 0) break;
                value += ')';
            }
        }

        return value;
    }

    private skipWhitespaces() {
        if (!this.isWhitespace(this.currentChar)) {
            return false;
        }

        while (this.isWhitespace(this.currentChar)) {
            this.lastWhitespace = true;
            if (['\n', '\r'].includes(this.currentChar || '')) {
                this.line++;
                this.character = 0;
            }
            this.advance();
        }

        return true;
    }

    private lexBladeComment() {
        this.addToken(TokenKind.BLADE_COMMENT_START);
        this.advance(4); // Skip the first '{{--'

        const pos = this.pos();
        let value = this.readUntil(
            (char) => char === '-' && this.isWord('--}}'),
            (_char) => true
        );

        if (this.isWord('--}}')) {
            this.addToken(TokenKind.BLADE_COMMENT, value, pos);
            this.addToken(TokenKind.BLADE_COMMENT_END, value, pos);
            this.advance(4); // Skip the '--}}'
        }
        this.setLastState();
    }

    private lexBladeEcho() {
        this.addToken(TokenKind.BLADE_ECHO_START);
        this.advance(2); // Skip the '{{'
        const pos = this.pos();
        const value = this.readUntil(
            (char) => char === '}' && this.isWord('}}'),
            (_char) => true
        );

        if (this.isWord('}}')) {
            this.addToken(TokenKind.PHP, value, pos);
            this.addToken(TokenKind.BLADE_ECHO_END);
            this.advance(2); // Skip the '}}'
        } else {
            this.tokens.pop(); // BLADE_ECHO_START
            this.addToken(TokenKind.TEXT, `{{${value}`, pos); // fixme: what if we were WithInOpenTag
        }
        this.setLastState();
    }

    private lexBladeRaw() {
        this.addToken(TokenKind.BLADE_RAW_START);
        this.advance(3); // Skip the first '{!!'
        const pos = this.pos();
        let value = this.readUntil(
            (char) => char === '!' && this.isWord('!!}'),
            (_char) => true
        );

        if (this.isWord('!!}')) {
            this.addToken(TokenKind.PHP, value, pos);
            this.addToken(TokenKind.BLADE_RAW_END, value, pos);
            this.advance(3); // Skip the '!!}'
        } else {
            this.tokens.pop(); // BLADE_RAW_START
            this.addToken(TokenKind.TEXT, `{!!${value}`, pos); // fixme: what if we were WithInOpenTag
        }
        this.setLastState();
    }

    private lexCss() {
        const pos = this.pos();
        const value = this.readUntil(
            (char) => char === '<' && this.isWord('</style'),
            (char) => char === '<' && this.isWord('</')
        );
        // todo: can have valid blade syntax
        this.addToken(TokenKind.CSS, value, pos, this.pos(this.index - 1));
        this.setState(State.CloseTag);
    }

    private lexJs() {
        const pos = this.pos();
        const value = this.readUntil(
            (char) => char === '<' && this.isWord('</script'),
            (char) => char === '<' && this.isWord('</')
        );
        // todo: can have valid blade syntax
        this.addToken(TokenKind.JS, value, pos, this.pos(this.index - 1));
        this.setState(State.CloseTag);
    }

    private lexPhp() {
        this.advance(this.isWord('<?php') ? 5 : 3); // Skip <?php or <?=
        const pos = this.pos();
        const value = this.readUntil((char) => char === '?' && this.isWord('?>'));
        this.addToken(TokenKind.PHP, value, pos, this.pos(this.index - 1));
        this.advance(2); // Skip the '?>'
        this.setLastState();
    }

    private lexWithInAttribute() {
        if (!this.isChar('=')) {
            return this.setState(State.WithInOpenTag);
        }
        this.addToken(TokenKind.EQUAL, '=');
        this.advance(); // Skip '='

        this.skipWhitespaces(); // maybe we have whitespace after equal sign
        if (this.isChar('"') || this.isChar("'")) {
            const quote = this.currentChar || '';
            this.addToken(TokenKind.QUOTE, quote);
            this.advance(); // Skip the opening quote (single or double)

            const pos = this.pos();

            const value = this.readUntil(
                (char) => char === quote
                // (char) => ['"', "'", '<', '/', '>'].includes(char) // todo: improve it
            );

            // todo: this value can have blade syntax
            // "foo bar {{ $kmas }} @if($buzz->isTrue()) bla bla @endif"
            // @ and {{ }} can exists in attributeValue
            // attribute value can be a language, like onclick="alert('something')"
            this.addToken(TokenKind.ATTRIBUTE_VALUE, value, pos);

            this.addToken(TokenKind.QUOTE, quote);
            this.advance(); // Skip the closing quote (single or double)

            return this.setState(State.WithInOpenTag);
        }

        const pos = this.pos();
        const value = this.readUntil(
            (char) => ['>', '<', '"', "'", '`', '='].includes(char) || this.isWhitespace(char)
        );

        if (value !== '') {
            // todo: this value can have blade syntax
            this.addToken(TokenKind.ATTRIBUTE_VALUE, value, pos);
        }

        return this.setState(State.WithInOpenTag);
    }

    private lexWithInOpenTag() {
        if (this.isChar('/')) {
            this.addToken(TokenKind.SLASH, '/');
            this.advance();
            this.skipWhitespaces();
        }

        if (this.isChar('>')) {
            this.addToken(TokenKind.ANGLE_CLOSE, '>');
            this.advance();
            let state = State.Text;

            if (this.lastTagName.toLowerCase() === 'style') {
                state = State.Css;
            }
            if (this.lastTagName.toLowerCase() === 'script') {
                state = State.Js;
            }
            return this.setState(state);
        }

        if (this.bladeStates()) {
            return;
        }

        if (this.isChar('<')) {
            // either we are missing '>' or it is start of attribute,
            // as <div fo<o="bar"> is valid,
            // but we'll assume that no one uses '<' in attribute name
            return this.setState(State.Text);
        }

        let value = '';
        if (this.isChar('=')) {
            value = '=';
            this.advance();
        }
        const pos = this.pos();
        value = this.readUntil((char) => ['/', '>', '<', '='].includes(char) || this.isWhitespace(char));

        // todo: this value can have blade syntax
        this.addToken(TokenKind.ATTRIBUTE, value, pos);
        return this.setState(State.WithInAttribute);
    }

    private lexOpenTag() {
        this.addToken(TokenKind.ANGLE_OPEN, '<');
        this.advance();

        const pos = this.pos();
        const tagName = this.readUntil((char) => ['/', '>', '<'].includes(char) || this.isWhitespace(char));

        this.lastTagName = tagName;
        this.addToken(TokenKind.TAG_NAME, tagName, pos);
        this.setState(State.WithInOpenTag);
    }

    private lexCloseTag() {
        this.addToken(TokenKind.ANGLE_OPEN, '<');
        this.advance();
        this.addToken(TokenKind.SLASH, '/');
        this.advance();
        if (this.isAlpha(this.currentChar)) {
            const pos = this.pos();
            const tagName = this.readUntil((char) => ['/', '>', '<'].includes(char) || this.isWhitespace(char));
            this.addToken(TokenKind.TAG_NAME, tagName, pos);

            this.lastTagName = '';
        }

        this.skipWhitespaces();

        if (this.isChar('>')) {
            this.addToken(TokenKind.ANGLE_CLOSE, '>');
            this.advance();
        }
        return this.setState(State.Text);
    }

    private lexHtmlComment() {
        this.advance(4); // Skip '<!--'
        const pos = this.pos();
        const value = this.readUntil(
            (char) => char === '-' && this.isWord('-->')
            // (_char) => char === '-' && this.isWord('-->'),
        );
        // todo: value can have valid blade and php
        this.addToken(TokenKind.HTML_COMMENT, value, pos);
        this.advance(3); // Skip the '-->'
        this.setState(State.Text);
    }

    private bladeStates(): boolean {
        if (this.isChar('<') && (this.isWord('<?php') || this.isWord('<?='))) {
            return this.setState(State.Php);
        }

        if (this.isChar('{')) {
            if (this.isWord('{{--')) {
                return this.setState(State.BladeComment);
            }

            if (this.isWord('{{')) {
                return this.setState(State.BladeEcho);
            }

            if (this.isWord('{!!')) {
                return this.setState(State.BladeRaw);
            }
        }
        if (this.isChar('@')) {
            if (this.isAlpha(this.input[this.index + 1])) {
                return this.setState(State.At);
            }
        }

        return false;
    }

    private lexText() {
        let value = '';
        const pos = this.pos();
        const endCharacters = ['<', '@', '{'];

        if (this.bladeStates()) {
            return;
        }

        if (this.isChar('<')) {
            if (this.isAlpha(this.input[this.index + 1])) {
                return this.setState(State.OpenTag);
            }

            if (this.isWord('<!--')) {
                return this.setState(State.HtmlComment);
            }

            if (this.isWord('</')) {
                return this.setState(State.CloseTag);
            }
        }

        if (this.isChar('@')) {
            const peek = this.input[this.index + 1];
            if (peek === '@' || peek === '{') {
                // @{ or @@
                value += this.readUntil((char) => this.isWhitespace(char));
            }
        }

        if (endCharacters.includes(this.currentChar || '')) {
            value += this.currentChar || '';
            this.advance();
        }

        value += this.readUntil((char) => endCharacters.includes(char));
        this.addToken(TokenKind.TEXT, value, pos);
        return;
    }

    private addToken(kind: TokenKind, value: string = '', pos?: Position, end?: Position) {
        pos = pos ?? this.pos();

        this.tokens.push({
            kind,
            value,
            afterWhitespace: this.lastWhitespace,
            pos,
            end,
        });
        this.lastWhitespace = false;
    }

    lex(): Token[] {
        while (this.currentChar !== null) {
            this.skipWhitespaces();

            switch (this.state) {
                case State.Text:
                    this.lexText();
                    break;
                case State.OpenTag:
                    this.lexOpenTag();
                    break;
                case State.WithInOpenTag:
                    this.lexWithInOpenTag();
                    break;
                case State.WithInAttribute:
                    this.lexWithInAttribute();
                    break;
                case State.CloseTag:
                    this.lexCloseTag();
                    break;

                case State.HtmlComment:
                    this.lexHtmlComment();
                    break;
                case State.BladeEcho:
                    this.lexBladeEcho();
                    break;
                case State.BladeRaw:
                    this.lexBladeRaw();
                    break;
                case State.BladeComment:
                    this.lexBladeComment();
                    break;
                case State.At:
                    this.lexAt();
                    break;
                case State.Php:
                    this.lexPhp();
                    break;
                case State.Js:
                    this.lexJs();
                    break;
                case State.Css:
                    this.lexCss();
                    break;

                default:
                    this.lexText();
                    break;
            }
        }
        this.addToken(TokenKind.EOF);

        return this.tokens;
    }
}

