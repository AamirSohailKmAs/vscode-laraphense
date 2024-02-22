'use strict';

export type triviaDataType = { text?: string; lastSkipped?: boolean };

export class Token<TokenKind, triviaType extends triviaDataType = {}> {
    public kind: TokenKind;
    public start: number;
    public length: number;
    public triviaData?: triviaType;

    constructor(kind: TokenKind, start: number, length: number, triviaData?: triviaType) {
        this.kind = kind;
        this.start = start;
        this.length = length;
        this.triviaData = triviaData;
    }

    public getText(source: string) {
        return source.substring(this.start, this.start + this.length);
    }
}

type TokenDefinition<TokenKind> = { regex: RegExp; kind?: TokenKind; tokenMap: Record<string, TokenKind> };

export class Tokenizer<TokenKind, triviaType extends triviaDataType = {}> {
    public code: string = '';
    public length: number = 0;
    public position: number = 0;
    public lastSkipped: Token<TokenKind> | null = null;

    constructor(
        private _tokenDefinitions: TokenDefinition<TokenKind>[],
        private _skippables: TokenKind[],
        private _endOfFile: TokenKind,
        private _unrecognized: TokenKind,
        private _triviaFunction?: (
            matchedToken: Token<TokenKind>,
            tokenizer: Tokenizer<TokenKind, triviaType>
        ) => triviaType | undefined
    ) {}

    public setInput(code: string) {
        this.code = code;
        this.length = code.length;
    }

    public setOffset(offset: number) {
        this.position = offset;
    }

    public isEndOfFile(): boolean {
        return this.position >= this.length;
    }

    public peekToken(upto: number = 1): Token<TokenKind, triviaType> {
        const pos = this.position;
        let token = this.nextToken();

        for (let i = 1; i < upto; i++) {
            token = this.nextToken();
            if (token.kind === this._endOfFile) {
                break;
            }
        }

        this.setOffset(pos);
        return token;
    }

    public nextToken(): Token<TokenKind, triviaType> {
        if (this.isEndOfFile()) {
            return new Token(this._endOfFile, this.position, this.length - this.position);
        }

        for (const tokenDefinition of this._tokenDefinitions) {
            const match: Token<TokenKind, triviaType> | null = this._regexMatch(tokenDefinition);

            if (match === null) {
                continue;
            }

            if (this._isSkippable(match.kind)) {
                this.lastSkipped = match;
                return this.nextToken();
            }

            if (this._triviaFunction) {
                match.triviaData = this._triviaFunction(match, this);
            }

            if (this.lastSkipped !== null) {
                this.lastSkipped = null;
            }

            return match;
        }

        const pos = this.position;
        this.position++;

        return new Token(this._unrecognized, pos, this.position - pos);
    }

    public advanceIfRegex(regex: RegExp, includeMatchLengthInPosition: boolean = true): string {
        const str = this.code.substring(this.position);
        const match = str.match(regex);
        if (match) {
            this.position = this.position + match.index!;
            if (includeMatchLengthInPosition) {
                this.position += match[0].length;
            }
            return match[0];
        }
        return '';
    }

    public advanceUntilRegex(regex: RegExp) {
        const str = this.code.substring(this.position);
        const match = str.match(regex);
        if (match) {
            this.position = this.position + match.index!;
            return match.index!;
        }
        const pos = this.position;
        this.position = this.length;

        return this.length - pos;
    }

    private _regexMatch(definition: TokenDefinition<TokenKind>): Token<TokenKind, triviaType> | null {
        const matches = this.code.substring(this.position).match(definition.regex);

        if (matches === null) {
            return null;
        }

        let kind: TokenKind | undefined = definition.kind ?? definition.tokenMap[matches[0].toLowerCase()];

        if (kind === undefined) {
            kind = this._unrecognized;
        }

        const pos = this.position;
        this.position += matches[0].length;

        return new Token(kind, pos, matches[0].length);
    }

    private _isSkippable(type: TokenKind): boolean {
        return this._skippables.indexOf(type) !== -1;
    }

    public static buildRegexFromSpecialCharacters(
        specialChars: string[],
        prefix: string = '',
        suffix: string = '',
        flags?: string | undefined
    ): RegExp {
        const escapedChars = specialChars.map((char) => char.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        const specialCharsPattern = escapedChars.join('|');
        return new RegExp(`${prefix}(${specialCharsPattern})${suffix}`, flags);
    }
}

