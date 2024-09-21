'use strict';

export type Position = { line: number; character: number; offset: number };

export type Loc = {
    start: Position;
    end: Position;
};

export type EnvNode = {
    text: string;
    loc: Loc;
};

export type ErrorNode = EnvNode;
export type CommentNode = EnvNode;

export type KeyValuePair = {
    comment?: CommentNode;
    key: EnvNode;
    value: EnvNode;
};

export type ASTNode = {
    children: KeyValuePair[];
    errors: ErrorNode[];
    comments: CommentNode[];
};

export class EnvParser {
    private offset: number = 0;
    private lastComment: CommentNode | undefined = undefined;
    private ast: ASTNode = { children: [], errors: [], comments: [] };

    public parse(content: string): ASTNode {
        this.reset();

        content.split('\n').forEach((line, lineNumber) => {
            this.processLine(line, lineNumber);
        });

        return this.ast;
    }

    private reset() {
        this.offset = 0;
        this.lastComment = undefined;
        this.ast = { children: [], errors: [], comments: [] };
    }

    private processLine(line: string, lineNumber: number): void {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
            this.offset += line.length + 1; // Handle empty lines
            this.lastComment = undefined;
            return;
        }

        if (this.isComment(trimmedLine)) {
            this.handleComment(trimmedLine, lineNumber);
        } else {
            this.handleKeyValuePair(trimmedLine, lineNumber);
            this.lastComment = undefined;
        }

        this.offset += line.length + 1; // Include newline character
    }

    private isComment(line: string): boolean {
        return line.startsWith('#');
    }

    private handleComment(line: string, lineNumber: number): void {
        const start = this.createPosition(lineNumber, 0);
        const end = this.createPosition(lineNumber, line.length);

        this.lastComment = {
            text: line.slice(1).trim(),
            loc: { start, end },
        };

        this.ast.comments.push(this.lastComment);
    }

    private handleKeyValuePair(line: string, lineNumber: number): void {
        const keyMatch = this.matchKey(line);

        if (!keyMatch) {
            this.logError('Invalid key-value pair', line, lineNumber);
            return;
        }

        const keyText = keyMatch[0].split('=')[0].trim();
        const keyLoc = this.createLoc(line, lineNumber, keyText);
        const valueText = line.slice(keyMatch[0].length).trim();

        const valueLoc = this.createLoc(line, lineNumber, valueText);

        if (this.isInvalidValue(valueText, keyText, line, lineNumber)) {
            return;
        }

        const pair: KeyValuePair = {
            comment: this.lastComment,
            key: { text: keyText, loc: keyLoc },
            value: { text: valueText, loc: valueLoc },
        };

        this.ast.children.push(pair);
    }

    private matchKey(line: string): RegExpMatchArray | null {
        return /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*/.exec(line);
    }

    private isInvalidValue(value: string, keyName: string, line: string, lineNumber: number): boolean {
        if (!value) {
            this.logError(`Missing value for key "${keyName}"`, line, lineNumber);
            return true;
        }

        if ((value.startsWith('"') && !value.endsWith('"')) || (value.startsWith("'") && !value.endsWith("'"))) {
            this.logError(`Unclosed quotes for value of key "${keyName}"`, line, lineNumber);
            return true;
        }

        return false;
    }

    private logError(message: string, line: string, lineNumber: number): void {
        const start = this.createPosition(lineNumber, 0);
        const end = this.createPosition(lineNumber, line.length);
        this.ast.errors.push({ text: message, loc: { start, end } });
    }

    private createLoc(line: string, lineNumber: number, text: string): Loc {
        const start = this.createPosition(lineNumber, line.indexOf(text));
        const end = this.createPosition(lineNumber, start.character + text.length);
        return { start, end };
    }

    private createPosition(lineNumber: number, character: number): Position {
        return { line: lineNumber, character, offset: this.offset + character };
    }
}

export function extractReferencedKeys(value: string): string[] {
    const matches = value.match(/\${([^}]+)}/g);
    return matches ? matches.map((match) => match.slice(2, -1)) : [];
}

export function determineValueType(value: string) {
    if (/^(true|false)$/i.test(value)) {
        return 'Boolean';
    }

    if (!isNaN(Number(value))) {
        return 'Number';
    }

    if (/\${[^}]+}/.test(value)) {
        return 'SpecialString';
    }

    return 'String';
}

