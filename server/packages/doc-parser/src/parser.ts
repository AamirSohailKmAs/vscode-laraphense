'use strict';

import { Loc, PHPDocLexer, Position, Token, TokenKind, initialPosition } from './lexer';

// AST Node Types
interface ASTNode {
    name: string;
    kind: TokenKind;
    loc: Loc;
}

interface PHPDocNode {
    kind: 'PHPDoc';
    summary?: string;
    description?: string;
    children: TagNode[];
    loc: Loc;
}
interface TagNode extends ASTNode {
    name: string;
    children: ASTNode[];
}

export class PHPDocParser {
    private tokens: Token[];
    private currentTokenIndex: number;
    private lexer: PHPDocLexer;

    constructor() {
        this.lexer = new PHPDocLexer();
        this.tokens = [];
        this.currentTokenIndex = 0;
    }

    public parse(input: string, start: Position = initialPosition): PHPDocNode {
        this.tokens = this.lexer.tokenize(input, { ...start });
        this.currentTokenIndex = 0;

        this.skipInitialNewLines();

        const summary = this.parseText(true);
        const description = this.parseText(false);
        const children = this.parseTags();

        return {
            kind: 'PHPDoc',
            summary,
            description,
            loc: { start, end: this.tokens[this.tokens.length - 1].pos },
            children,
        };
    }

    private parseTags(): TagNode[] {
        const children: TagNode[] = [];

        while (this.hasMoreTokens()) {
            const token = this.getCurrentToken();
            if (!token) break;

            this.advance();

            if (token.kind === TokenKind.NewLine || token.kind !== TokenKind.Tag) {
                continue;
            }

            const tagNode = this.parseTag(token);
            if (tagNode) children.push(tagNode);
        }

        return children;
    }

    private skipInitialNewLines(): void {
        while (this.hasMoreTokens()) {
            const token = this.getCurrentToken();
            if (!token || token.kind !== TokenKind.NewLine) break;
            this.advance();
        }
    }

    private parseTag(token: Token): TagNode | undefined {
        const children = this.parseTagValue(token);

        if (children.length === 0) {
            return undefined;
        }

        return {
            kind: TokenKind.Tag,
            name: token.value,
            loc: { start: token.pos, end: this.getCurrentPosition() },
            children,
        };
    }

    private pushIfNodeExists(children: ASTNode[], node: ASTNode | undefined): void {
        if (node) children.push(node);
    }

    private parseTagValue(token: Token): ASTNode[] {
        const children: ASTNode[] = [];
        // case 'see':
        // case 'method':

        // case 'template':
        // case 'template-covariant':

        const tagWithTypeAndVariable = ['var', 'global', 'param', 'property', 'property-read', 'property-write'];

        const tagWithTypeOnly = [
            'return',
            'mixin',
            'throws',
            'template-extends',
            'extends',
            'template-implements',
            'implements',
            'template-use',
            'use',
        ];
        const tagWithDescriptionOnly = [
            'api',
            'internal',
            'author',
            'license',
            'copyright',
            'todo',
            'package',
            'since',
            'deprecated',
            'removed',
            'example',
            'link',
            'version',
            'uses',
        ];

        if (tagWithTypeAndVariable.includes(token.value)) {
            this.pushIfNodeExists(children, this.parseToken(TokenKind.Type, this.getCurrentToken()));
            this.pushIfNodeExists(children, this.parseToken(TokenKind.Variable, this.getCurrentToken()));
            this.pushIfNodeExists(children, this.parseToken(TokenKind.TagText, this.getCurrentToken()));
            return children;
        }

        if (tagWithTypeOnly.includes(token.value)) {
            this.pushIfNodeExists(children, this.parseToken(TokenKind.Type, this.getCurrentToken()));
            this.pushIfNodeExists(children, this.parseToken(TokenKind.TagText, this.getCurrentToken()));
            return children;
        }

        if (tagWithDescriptionOnly.includes(token.value)) {
            this.pushIfNodeExists(children, this.parseToken(TokenKind.TagText, this.getCurrentToken()));
            return children;
        }

        return children;
    }

    private parseToken(kind: TokenKind, token?: Token): ASTNode | undefined {
        if (!token || token.kind !== kind) return undefined;

        this.advance(); // Move past the token

        return {
            kind: kind,
            name: token.value,
            loc: this.loc(token.pos, token.value),
        };
    }

    private parseText(isSummary: boolean): string | undefined {
        let text = '';
        let newLine = 0;

        while (this.hasMoreTokens()) {
            const token = this.getCurrentToken();

            if (!token || (token.kind !== TokenKind.Text && token.kind !== TokenKind.NewLine)) {
                break;
            }

            if (token.kind === TokenKind.NewLine) newLine++;

            this.advance();
            text += token.value;

            if (isSummary && (newLine >= 2 || token.value.slice(-1) === '.')) {
                break;
            }
        }
        return text.trim() ? text.trim() : undefined;
    }

    private advance() {
        if (this.hasMoreTokens()) {
            this.currentTokenIndex++;
        }
    }

    private getCurrentToken(): Token | undefined {
        return this.tokens[this.currentTokenIndex] || undefined;
    }

    private hasMoreTokens(): boolean {
        return this.currentTokenIndex < this.tokens.length;
    }

    private getCurrentPosition(): Position {
        const token = this.getCurrentToken();

        return token ? token.pos : { ...initialPosition };
    }

    private loc(start: Position, text: string): Loc {
        const end = {
            line: start.line + text.split('\n').length - 1,
            character: text.lastIndexOf('\n') === -1 ? start.line + text.length : start.line + text.slice(0, -1).length,
            offset: start.offset + text.length,
        };
        return { start, end };
    }
}

