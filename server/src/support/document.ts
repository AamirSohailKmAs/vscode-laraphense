'use strict';

import { DocumentUri, Position, Range, TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { Debounce } from '../support/debounce';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { guessLangFromUri, toDocLang } from '../helpers/uri';
import { EmbeddedLanguage, Tree, newAstTree } from '../bladeParser/bladeAst';
import { Program } from 'php-parser';
import { CSS_STYLE_RULE } from '../languages/cssLang';
import { toLocation } from '../languages/php/indexing/symbol';
import { substituteWithWhitespace } from '../helpers/general';
import { BinarySearch } from './searchTree';

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

export class FlatDocument {
    static fromTextDocument(doc: TextDocument): FlatDocument {
        return new FlatDocument(doc.uri, toDocLang(doc.languageId), doc.version, doc.getText());
    }

    public createdAt: number;
    public lastCompile: [number, number] = [0, 0];
    public compileDebounce?: Debounce<unknown, unknown>;
    public diagnoseDebounce?: Debounce<unknown, unknown>;
    private _lineLengths: Array<number> = [];
    private WORD_REGEX: string | RegExp = /[\w\d\-_\.\:\\\/@]+$/;
    private _search: BinarySearch;
    constructor(
        private _uri: DocumentUri,
        private _languageId: DocLang,
        private _version: number,
        private _content: string,
        public isOpened: boolean = false,
        createdAt?: number
    ) {
        this.createdAt = createdAt ?? Date.now();
        this.lastCompile = process.hrtime();
        this._lineLengths = this.lineLengths(_content, true);
        this._search = new BinarySearch(this._lineLengths);
    }

    public get doc() {
        return TextDocument.create(this._uri, this._languageId, this._version, this._content);
    }

    public get uri() {
        return this._uri;
    }

    public get version() {
        return this._version;
    }

    public get languageId() {
        return this._languageId;
    }

    get lineOffsets() {
        return this._lineLengths.slice(0);
    }

    positionAt(offset: number) {
        offset = Math.max(Math.min(offset, this._content.length), 0);
        let lineOffsets = this.lineOffsets;
        let low = 0,
            high = lineOffsets.length;
        if (high === 0) {
            return { line: 0, character: offset };
        }
        while (low < high) {
            let mid = Math.floor((low + high) / 2);
            if (lineOffsets[mid] > offset) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        // low is the least x for which the line offset is larger than the current offset
        // or array.length if no line offset is larger than the current offset
        let line = low - 1;
        return { line, character: offset - lineOffsets[line] };
    }

    get lineCount() {
        return this.lineOffsets.length;
    }

    public offsetAt(position: Position): number {
        let lineOffsets = this.lineOffsets;
        if (position.line >= lineOffsets.length) {
            return this._content.length;
        } else if (position.line < 0) {
            return 0;
        }
        let lineOffset = lineOffsets[position.line];
        let nextLineOffset =
            position.line + 1 < lineOffsets.length ? lineOffsets[position.line + 1] : this._content.length;
        return Math.max(Math.min(lineOffset + position.character, nextLineOffset), lineOffset);
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
        if (range) {
            const start = this.offsetAt(range.start);
            const end = this.offsetAt(range.end);
            return this._content.substring(start, end);
        }
        return this._content;
    }

    public getWordAtPosition(position: Position, regex?: string | RegExp) {
        const offset = this.doc.offsetAt(position);
        let match = this.doc
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
        for (let i = 0, l = changes.length; i < l; ++i) {
            const change = changes[i];
            if ('range' in change) {
                this.applyChange(change.range.start, change.range.end, change.text);
            } else {
                this._content = change.text;
                this._lineLengths = this.lineLengths(change.text, true, 0);
            }
        }

        this._version = version;
    }

    applyChange(start: Position, end: Position, text: string) {
        // update content
        const startOffset = this.positionToOffset(start);
        const endOffset = this.positionToOffset(end);
        this._content = this._content.slice(0, startOffset) + text + this._content.slice(endOffset);

        // update the offsets
        let lineOffsets = this._lineLengths;
        const addedLineOffsets = this.lineLengths(text, false, startOffset);
        if (end.line - start.line === addedLineOffsets.length) {
            for (let i = 0, len = addedLineOffsets.length; i < len; i++) {
                lineOffsets[i + start.line + 1] = addedLineOffsets[i];
            }
        } else {
            if (addedLineOffsets.length < 10000) {
                lineOffsets.splice(start.line + 1, end.line - start.line, ...addedLineOffsets);
            } else {
                // avoid too many arguments for splice
                this._lineLengths = lineOffsets = lineOffsets
                    .slice(0, start.line + 1)
                    .concat(addedLineOffsets, lineOffsets.slice(end.line + 1));
            }
        }
        const diff = text.length - (endOffset - startOffset);
        if (diff !== 0) {
            for (let i = start.line + 1 + addedLineOffsets.length, len = lineOffsets.length; i < len; i++) {
                lineOffsets[i] = lineOffsets[i] + diff;
            }
        }

        let chunkFirst = this._lineLengths.slice(0, start.line + 1);
        let length = text.length - (endOffset - startOffset);
        Array.prototype.push.apply(chunkFirst, this.lineLengths(text, false, startOffset).slice(1));
        let chunkLast = this._lineLengths.slice(end.line + 1);
        for (let e = 0, t = chunkLast.length; e < t; ++e) {
            chunkFirst.push(chunkLast[e] + length);
        }
        this._lineLengths = chunkFirst;
        this._search.sortedArray = this._lineLengths;
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
        return Math.max(0, Math.min(offset, this._content.length));
    }

    textToLeftOfOffset(end: number, start: number) {
        const begin = Math.max(end - start, 0);
        return this._content.slice(begin, end);
    }
    lineText(offset: number) {
        const line = this.offsetLine(offset);
        return this._content.slice(this._lineLengths[line], offset);
    }
    wordToLeftOfOffset(offset: number, regex?: string | RegExp) {
        const line = this.offsetLine(offset);
        let match = this._content.slice(this._lineLengths[line], offset).match(regex || this.WORD_REGEX);
        if (match) {
            return match[0];
        } else {
            return '';
        }
    }

    textToRightOfOffset(from: number, length: number) {
        return this._content.substr(from, length);
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
        return this._content.slice(start, end);
    }
    lineLength(line: number) {
        let length = this._lineLengths[line];
        if (length === undefined) {
            return 0;
        }
        let fullLength = this._lineLengths[line + 1] || this._content.length;
        return Math.max(0, fullLength - length);
    }

    protected lineLengths(text: string, isAtLineStart: boolean = true, textOffset = 0) {
        const offsets: Array<number> = isAtLineStart ? [textOffset] : [];

        let newLine = false;

        for (let i = 0, l = text.length; i < l; i++) {
            const char = text[i];
            if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
                i++;
            }

            if (char === '\n') newLine = true;

            if (newLine) {
                this._lineLengths.push(i);
                newLine = false;
            }
        }

        return offsets;
    }
}

export class Regions {
    private _regions: EmbeddedLanguage[] = [];
    private _defaultLang: DocLang;
    private _tree: Tree;

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

        this._tree = newAstTree();
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
        this._tree = tree;
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
                return region.name;
            }
        }

        return this._defaultLang;
    }

    public docLangsInDocument(maxLanguages: number = 3): DocLang[] {
        const result = [this._defaultLang];
        for (const region of this._regions) {
            if (result.indexOf(region.name) !== -1) {
                continue;
            }
            result.push(region.name);
            if (result.length === maxLanguages) {
                return result;
            }
        }

        return result;
    }

    public getEmbeddedDocument(
        document: FlatDocument,
        languageId: DocLang,
        ignoreAttributeValues: boolean = false
    ): FlatDocument {
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
        return new FlatDocument(document.uri, languageId, document.version, result);
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

