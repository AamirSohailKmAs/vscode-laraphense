'use strict';

import { DocumentUri } from 'vscode-languageserver';
import { Debounce } from '../support/debounce';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { guessLangFromUri, toDocLang } from '../helpers/uri';
import { EmbeddedLanguage, Tree } from '../types/bladeAst';
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
    private regions: EmbeddedLanguage[] = [];
    private defaultLang: DocLang;

    constructor(uri: DocumentUri) {
        switch (guessLangFromUri(uri)) {
            case DocLang.blade:
                this.defaultLang = DocLang.blade;
                break;
            case DocLang.php:
                this.defaultLang = DocLang.html;
                break;
            default:
                this.defaultLang = DocLang.unknown;
                break;
        }
    }

    private dispatchMap: Record<string, (node: any) => void> = {
        tree: (_node: Tree) => {
            this.regions = [];
        },
        program: (node: Program) => {
            this.regions.push({
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
            this.regions.push(node);
        },
    };

    parse(tree: Tree) {
        this.regions = [];
        tree.children.forEach((child) => {
            this.dispatchMap[child.kind]?.(child);
        });

        return this;
    }

    docLangAtOffset(offset: number): DocLang {
        for (const region of this.regions) {
            if (offset < region.loc.start.offset) {
                continue;
            }

            if (offset <= region.loc.end.offset) {
                return region.name;
            }
        }

        return this.defaultLang;
    }

    docLangsInDocument(maxLanguages: number = 3): DocLang[] {
        const result = [this.defaultLang];
        for (const region of this.regions) {
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

    getEmbeddedDocument(
        document: TextDocument,
        languageId: DocLang,
        ignoreAttributeValues: boolean = false
    ): TextDocument {
        let currentPos = 0;
        const oldContent = document.getText();
        let result = '';
        let lastSuffix = '';
        for (const c of this.regions) {
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
        return TextDocument.create(document.uri, languageId, document.version, result);
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

    getSuffix(c: EmbeddedLanguage) {
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

