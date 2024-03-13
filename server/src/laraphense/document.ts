'use strict';

import { DocumentUri } from 'vscode-languageserver';
import { Debounce } from '../support/debounce';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { toDocLang } from '../helpers/uri';

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
        public languageId: DocLang,
        version: number,
        content: string,
        public isOpened: boolean = false,
        createdAt?: number
    ) {
        this.doc = TextDocument.create(uri, languageId, version, content);
        this.createdAt = createdAt ?? Date.now();
        this.lastCompile = process.hrtime();
    }
}

