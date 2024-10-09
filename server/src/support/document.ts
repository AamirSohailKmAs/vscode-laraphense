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
import { AstNode, EmbeddedLanguage, Tree, newAstTree } from '@porifa/blade-parser';

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
    public lastCompile: [number, number] = [0, 0];
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
        public compileDebounce?: Debounce<TextDocumentContentChangeEvent[], boolean>,
        public diagnoseDebounce?: Debounce<unknown>
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

    /**
     * Converts a zero-based offset to a position.
     *
     * @param offset A zero-based offset.
     * @return A valid {@link Position position}.
     * @example The text document "ab\ncd" produces:
     * * position { line: 0, character: 0 } for `offset` 0.
     * * position { line: 0, character: 1 } for `offset` 1.
     * * position { line: 0, character: 2 } for `offset` 2.
     * * position { line: 1, character: 0 } for `offset` 3.
     * * position { line: 1, character: 1 } for `offset` 4.
     */
    positionAt(offset: number) {
        return this._doc.positionAt(offset);
    }

    /**
     * The number of lines in this document.
     *
     * @readonly
     */
    get lineCount() {
        return this._doc.lineCount;
    }

    /**
     * Converts the position to a zero-based offset.
     * Invalid positions are adjusted as described in {@link Position.line}
     * and {@link Position.character}.
     *
     * @param position A position.
     * @return A valid zero-based offset.
     */
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
    private _embeddedMap = new Map<string, EmbeddedLanguage[]>();

    private dispatchMap: Record<string, (node: any) => EmbeddedLanguage | undefined> = {
        program: (node: Program) => {
            return {
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
            };
        },
        language: (node: EmbeddedLanguage) => {
            if (node.name === DocLang.unknown) {
                return undefined;
            }
            return node;
        },
    };

    public set(uri: string, children: (AstNode | Program)[]) {
        const items = [];

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const docLang = this.dispatchMap[child.kind]?.(child);

            if (docLang) {
                items.push(docLang);
            }
        }

        this._embeddedMap.set(uri, items);
    }

    public clear() {
        this._embeddedMap.clear();
    }
    public delete(uri: string) {
        return this._embeddedMap.delete(uri);
    }

    public docLangAtOffset(uri: string, offset: number): DocLang {
        const regions = this._embeddedMap.get(uri);
        if (!regions) {
            return guessLangFromUri(uri);
        }

        for (const region of regions) {
            if (offset < region.loc.start.offset) {
                continue;
            }

            if (offset <= region.loc.end.offset) {
                return toDocLang(region.name);
            }
        }

        return guessLangFromUri(uri);
    }

    public docLangsInDocument(uri: string, maxLanguages: number = 3): DocLang[] {
        const result = [guessLangFromUri(uri)];
        const regions = this._embeddedMap.get(uri);
        if (!regions) {
            return result;
        }
        for (const region of regions) {
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

        const regions = this._embeddedMap.get(document.uri);

        if (!regions) {
            console.log(document.uri, Array.from(this._embeddedMap.keys()));

            return document;
        }

        for (const c of regions) {
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

