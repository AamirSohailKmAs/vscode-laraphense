export type Position = { line: number; character: number; offset: number };

export type Loc = {
    start: Position;
    end: Position;
};

export enum TokenKind {
    Tag = 'Tag',
    Text = 'Text',
    Type = 'Type',
    TagText = 'TagText',
    NewLine = 'NewLine',
    Variable = 'Variable',
}

export type Token = {
    kind: TokenKind;
    value: string;
    pos: Position;
};

export enum LexerState {
    INITIAL,
    NEW_LINE,
    AFTER_STAR,
    TAG_LINE,
    BEFORE_END,
}

export const initialPosition = { line: 0, character: 0, offset: 0 };

export class PHPDocLexer {
    private state: LexerState = LexerState.INITIAL;
    private input: string = '';
    private position: number = 0;
    private pos: Position = initialPosition;
    private tokens: Token[] = [];

    public tokenize(input: string, startPos: Position): Token[] {
        this.state = LexerState.INITIAL;
        this.input = input;
        this.position = 0;
        this.tokens = [];
        this.pos = { ...startPos };

        while (this.position < this.input.length) {
            const char = this.char();

            if (char === '\n') {
                this.handleNewLine();
                continue;
            }

            this.nextToken(char);
        }

        return this.tokens;
    }

    private addToken(kind: TokenKind, value: string, pos: Position) {
        this.tokens.push({ kind, value, pos });
    }

    private nextToken(char: string): void {
        const stateHandlers: { [key: number]: (char: string) => void } = {
            [LexerState.INITIAL]: this.handleInitialState.bind(this),
            [LexerState.NEW_LINE]: this.handleNewLineState.bind(this),
            [LexerState.AFTER_STAR]: this.handleAfterStarState.bind(this),
            [LexerState.TAG_LINE]: this.handleTagLineState.bind(this),
        };

        const handler = stateHandlers[this.state];
        if (handler) {
            return handler(char);
        }

        this.advance(); // Skip '*'
        this.advance(); // Skip '/'
    }
    private handleNewLine() {
        this.addToken(TokenKind.NewLine, '\n', this.currentPosition());

        this.advance(); // Move past the newline character

        if (this.state !== LexerState.INITIAL) {
            this.state = LexerState.NEW_LINE;
        }
    }

    private handleNewLineState(char: string) {
        if (char === '*') {
            this.advance();

            if (this.char() === '/') {
                this.state = LexerState.BEFORE_END;
            } else {
                this.state = LexerState.AFTER_STAR;
            }

            return;
        }

        return this.handleAfterStarState(char);
    }

    private handleAfterStarState(char: string) {
        if (char === '@') {
            this.state = LexerState.TAG_LINE;
            return;
        }

        if (this.isWhitespace(char)) {
            this.consumeWhitespace();
            return;
        }

        if (char === '*' && this.peek() === '/') {
            this.state = LexerState.BEFORE_END;
            return;
        }

        return this.readText();
    }

    private handleTagLineState(char: string) {
        if (char === '@') {
            return this.readTag();
        }

        this.state = LexerState.AFTER_STAR;
        return this.readTagText();
    }

    private handleInitialState(char: string) {
        this.consumeWhitespace();

        if (char === '/') {
            this.advance();
            this.readWhile((char) => this.isWhitespace(char) || char === '*');
            this.state = LexerState.AFTER_STAR;
        }

        if (char === '*' && this.peek() === '/') {
            this.advance(); // Skip '*'
            this.state = LexerState.BEFORE_END;
        }
    }

    private readTag() {
        this.advance(); // Skip '@'
        const start = this.currentPosition();
        const tag = this.readWhile((c) => /[a-zA-Z0-9-_]/.test(c));

        this.addToken(TokenKind.Tag, tag, start);
    }

    // Helper functions

    private consumeWhitespace(): void {
        this.readWhile((char) => /\s/.test(char));
    }

    // Read free-form text (like descriptions)
    private readText() {
        const start = this.currentPosition();
        const text = this.readWhile(() => true);
        this.addToken(TokenKind.Text, text, start);

        return;
    }

    private readTagText(): void {
        this.readPhpType();
        if (this.char() === '\n') {
            return;
        }
        this.readVariable();
        if (this.char() === '\n') {
            return;
        }

        this.consumeWhitespace();
        const pos = this.currentPosition();
        const text = this.readWhile(() => true);

        if (text.length > 0) {
            this.addToken(TokenKind.TagText, text, pos);
        }
    }

    /**
     *
     * @param condition loop will break if this returns false
     * @param callable this will call inside loop and it will NOT advance when this callable will run
     * @returns string
     */
    private readWhile(condition: (char: string) => boolean, callable?: (char: string) => string): string {
        let result = '';
        while (this.position < this.input.length && this.char() !== '\n' && condition(this.char())) {
            let char = this.char();
            if (callable) {
                result += callable(char);
            } else {
                this.advance();
                result += char;
            }
        }
        return result;
    }

    private isWhitespace(char: string): boolean {
        return /\s/.test(char);
    }

    private char() {
        return this.input[this.position];
    }

    private peek(n: number = 1) {
        return this.input[this.position + n];
    }

    private advance(): void {
        if (this.char() === '\n') {
            this.pos.line++;
            this.pos.character = 0;
        } else {
            this.pos.character++;
        }
        this.pos.offset++;
        this.position++;
    }

    private currentPosition(): Position {
        return {
            line: this.pos.line,
            character: this.pos.character,
            offset: this.pos.offset,
        };
    }

    private readPhpType(): void {
        this.consumeWhitespace();
        const pos = this.currentPosition();

        let type = this.readWhile(
            (char) => this.isPhpTypeChar(char),
            (char) => {
                if (char === '<') {
                    return this.processPair('<', '>');
                }
                if (char === '{') {
                    return this.processPair('{', '}');
                }
                if (char === '[' && this.peek() === ']') {
                    return this.processPair('[', ']');
                }
                if (char === '(') {
                    return this.processPair('(', ')');
                }

                return this.processUnionIntersection(char);
            }
        );

        if (type.length > 0) {
            this.addToken(TokenKind.Type, type, pos);
        }
    }

    private processPair(openChar: string, closeChar: string): string {
        let depth = 1;
        let text = openChar;
        this.advance();

        text += this.readWhile(
            () => depth > 0,
            (char) => {
                if (char === openChar) depth++;
                if (char === closeChar) depth--;
                this.advance();
                return char;
            }
        );

        // closeChar must be handle by parent for intersection or union
        this.position--;
        return text.slice(0, -1);
    }

    // Method to handle union (`|`) and intersection (`&`) types
    private processUnionIntersection(char: string): string {
        let text = char;
        this.advance();

        let n = 0;
        while (this.peek(n) === ' ') {
            n++;
        }

        if (n > 0 && (['|', '&'].includes(this.peek(n)) || ['|', '&'].includes(char))) {
            for (let i = 1; i <= n; i++) {
                text += this.char();
                this.advance();
            }
        }

        return text;
    }

    // Determine valid characters for PHP types (includes *, &, |, qualified names, etc.)
    private isPhpTypeChar(char: string): boolean {
        return /[a-zA-Z0-9_\\<>\[\]\(\)\{\}\|&,]/.test(char);
    }

    // Read PHP variables like `$name`
    private readVariable() {
        this.consumeWhitespace();
        if (this.char() !== '$') {
            return;
        }
        const pos = this.currentPosition();
        const variable = this.readWhile((c) => /[\$a-zA-Z0-9_]/.test(c));

        if (variable.length > 0) {
            this.addToken(TokenKind.Variable, variable, pos);
        }
    }
}

