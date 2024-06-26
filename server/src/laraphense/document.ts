'use strict';

import { DocumentUri } from 'vscode-languageserver';
import { Debounce } from '../support/debounce';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { guessLangFromUri, toDocLang } from '../helpers/uri';
import { EmbeddedLanguage, Tree, newAstTree } from '../bladeParser/bladeAst';
import { Program } from 'php-parser';
import { CSS_STYLE_RULE } from '../languages/cssLang';
import { toLocation } from '../languages/php/indexing/symbol';
import { substituteWithWhitespace } from '../helpers/general';

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

    public doc: TextDocument;
    public createdAt: number;
    public lastCompile: [number, number] = [0, 0];
    compileDebounce?: Debounce<unknown, unknown>;
    diagnoseDebounce?: Debounce<unknown, unknown>;
    constructor(
        uri: DocumentUri,
        languageId: DocLang,
        version: number,
        content: string,
        public isOpened: boolean = false,
        createdAt?: number
    ) {
        this.doc = TextDocument.create(uri, languageId, version, content);
        this.createdAt = createdAt ?? Date.now();
        this.lastCompile = process.hrtime();
    }

    public get languageId() {
        return this.doc.languageId as DocLang;
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
        const oldContent = document.doc.getText();
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
        return new FlatDocument(document.doc.uri, languageId, document.doc.version, result);
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

