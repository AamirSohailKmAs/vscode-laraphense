'use strict';

import { DocumentUri, Position, Range, TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { Debounce } from '../support/debounce';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { guessLangFromUri, toDocLang } from '../helpers/uri';
import { Program } from 'php-parser';
import { CSS_STYLE_RULE } from '../languages/cssLang';
import { toLocation } from '../helpers/symbol';
import { substituteWithWhitespace } from '../helpers/general';
import { BinarySearch } from './searchTree';
import { EmbeddedLanguage, Tree, newAstTree } from '@porifa/blade-parser';

export enum DocLang {
    html = 'html',
    css = 'css',
    js = 'js',
    ts = 'ts',
    json = 'json',
    php = 'php',
    blade = 'blade',
    unknown = 'unknown',
}

export class ASTDocument {
    static fromTextDocument(doc: TextDocument): ASTDocument {
        return new ASTDocument(doc.uri, toDocLang(doc.languageId), doc.version, doc.getText());
    }

    public lastCompile: [number, number] = [0, 0];
    public compileDebounce?: Debounce<unknown, unknown>;
    public diagnoseDebounce?: Debounce<unknown, unknown>;
    private _lineLengths: Array<number> = [];
    private WORD_REGEX: string | RegExp = /[\w\d\-_\.\:\\\/@]+$/;
    private _search: BinarySearch;
    private _doc: TextDocument;

    public isOpened: boolean;

    constructor(
        uri: DocumentUri,
        languageId: DocLang,
        version: number,
        content: string,
        isOpened: boolean = false,
        createdAt?: number
    ) {
        this.isOpened = isOpened;
        this.lastCompile = process.hrtime();
        this._doc = TextDocument.create(uri, languageId, version, content);

        this._lineLengths = this.lineLengths(content);
        this._search = new BinarySearch(this._lineLengths);
    }

    public get doc() {
        return TextDocument.create(this._doc.uri, this._doc.languageId, this._doc.version, this._doc.getText());
    }

    public get uri() {
        return this._doc.uri;
    }

    public get version() {
        return this._doc.version;
    }

    public get languageId(): DocLang {
        return this._doc.languageId as DocLang;
    }

    public get content() {
        return this._doc.getText();
    }

    get lineOffsets() {
        return this._lineLengths.slice(0);
    }

    positionAt(offset: number) {
        return this._doc.positionAt(offset);
    }

    get lineCount() {
        return this._doc.lineCount;
    }

    public offsetAt(position: Position): number {
        return this._doc.offsetAt(position);
    }

    /**
     * Get the text of this document. A substring can be retrieved by
     * providing a range.
     *
     * @param range (optional) An range within the document to return.
     * If no range is passed, the full content is returned.
     * Invalid range positions are adjusted as described in {@link Position.line}
     * and {@link Position.character}.
     * If the start range position is greater than the end range position,
     * then the effect of getText is as if the two positions were swapped.

     * @return The text of this document or a substring of the text if a
     *         range is provided.
     */
    public getText(range?: Range): string {
        return this._doc.getText(range);
    }

    public getWordAtPosition(position: Position, regex?: string | RegExp) {
        const offset = this._doc.offsetAt(position);
        let match = this._doc
            .getText()
            .slice(this._lineLengths[position.line], offset)
            .match(regex || this.WORD_REGEX);
        if (match) {
            return match[0];
        } else {
            return '';
        }
    }

    update(changes: TextDocumentContentChangeEvent[], version: number) {
        TextDocument.update(this._doc, changes, version);
    }

    lineOffset(line: number): number {
        if (line <= 0 || this._lineLengths.length < 1) {
            return 0;
        } else if (line > this._lineLengths.length - 1) {
            return this._lineLengths[this._lineLengths.length - 1];
        } else {
            return this._lineLengths[line];
        }
    }
    positionToOffset(position: Position) {
        const offset = this.lineOffset(position.line) + position.character;
        return Math.max(0, Math.min(offset, this.content.length));
    }

    textToLeftOfOffset(end: number, start: number) {
        const begin = Math.max(end - start, 0);
        return this.content.slice(begin, end);
    }
    lineText(offset: number) {
        const line = this.offsetLine(offset);
        return this.content.slice(this._lineLengths[line], offset);
    }
    wordToLeftOfOffset(offset: number, regex?: string | RegExp) {
        const line = this.offsetLine(offset);
        let match = this.content.slice(this._lineLengths[line], offset).match(regex || this.WORD_REGEX);
        if (match) {
            return match[0];
        } else {
            return '';
        }
    }

    textToRightOfOffset(from: number, length: number) {
        return this.content.substr(from, length);
    }
    offsetToPosition(offset: number): Position {
        const line = this.offsetLine(offset);
        return {
            line: line,
            character: offset - this._lineLengths[line],
        };
    }
    offsetLine(offset: number) {
        let result = this._search.search((mid) => mid - offset);
        if (result.isExactMatch) {
            return result.rank;
        } else {
            return Math.max(result.rank - 1, 0);
        }
    }
    getRangeText(range: Range) {
        let start = this.positionToOffset(range.start);
        let end = this.positionToOffset(range.end);
        return this.content.slice(start, end);
    }
    lineLength(line: number) {
        let length = this._lineLengths[line];
        if (length === undefined) {
            return 0;
        }
        let fullLength = this._lineLengths[line + 1] || this.content.length;
        return Math.max(0, fullLength - length);
    }

    protected lineLengths(text: string) {
        const lines = text.split('\n');
        return lines.map((line) => line.length);
    }
}

export class Regions {
    private _regions: EmbeddedLanguage[] = [];
    private _defaultLang: DocLang;

    constructor(uri: DocumentUri) {
        switch (guessLangFromUri(uri)) {
            case DocLang.blade:
                this._defaultLang = DocLang.blade;
                break;
            case DocLang.php:
                this._defaultLang = DocLang.html;
                break;
            default:
                this._defaultLang = DocLang.unknown;
                break;
        }
    }

    private dispatchMap: Record<string, (node: any) => void> = {
        tree: (_node: Tree) => {
            this._regions = [];
        },
        program: (node: Program) => {
            this._regions.push({
                name: DocLang.php,
                kind: 'language',
                loc: toLocation(
                    node.loc ?? {
                        source: null,
                        start: { line: 1, column: 0, offset: 1 },
                        end: { line: 1, column: 0, offset: 1 },
                    }
                ),
                attributeValue: false,
            });
        },
        language: (node: EmbeddedLanguage) => {
            if (node.name === DocLang.unknown) {
                return;
            }
            this._regions.push(node);
        },
    };

    public parse(tree: Tree) {
        this._regions = [];
        tree.children.forEach((child) => {
            this.dispatchMap[child.kind]?.(child);
        });

        return this;
    }

    public docLangAtOffset(offset: number): DocLang {
        for (const region of this._regions) {
            if (offset < region.loc.start.offset) {
                continue;
            }

            if (offset <= region.loc.end.offset) {
                return toDocLang(region.name);
            }
        }

        return this._defaultLang;
    }

    public docLangsInDocument(maxLanguages: number = 3): DocLang[] {
        const result = [this._defaultLang];
        for (const region of this._regions) {
            if (result.indexOf(toDocLang(region.name)) !== -1) {
                continue;
            }
            result.push(toDocLang(region.name));
            if (result.length === maxLanguages) {
                return result;
            }
        }

        return result;
    }

    public getEmbeddedDocument(
        document: ASTDocument,
        languageId: DocLang,
        ignoreAttributeValues: boolean = false
    ): ASTDocument {
        let currentPos = 0;
        const oldContent = document.getText();
        let result = '';
        let lastSuffix = '';
        for (const c of this._regions) {
            if (c.name === languageId && (!ignoreAttributeValues || !c.attributeValue)) {
                result = substituteWithWhitespace(
                    result,
                    currentPos,
                    c.loc.start.offset,
                    oldContent,
                    lastSuffix,
                    this.getPrefix(c)
                );
                result += oldContent.substring(c.loc.start.offset, c.loc.end.offset);
                currentPos = c.loc.end.offset;
                lastSuffix = this.getSuffix(c);
            }
        }
        result = substituteWithWhitespace(result, currentPos, oldContent.length, oldContent, lastSuffix, '');
        return new ASTDocument(document.uri, languageId, document.version, result);
    }

    private getPrefix(c: EmbeddedLanguage) {
        if (!c.attributeValue) {
            return '';
        }
        switch (c.name) {
            case DocLang.css:
                return CSS_STYLE_RULE + '{';
            default:
                return '';
        }
    }

    private getSuffix(c: EmbeddedLanguage) {
        if (!c.attributeValue) {
            return '';
        }
        switch (c.name) {
            case DocLang.css:
                return '}';
            case DocLang.js:
                return ';';
            default:
                return '';
        }
    }
}

