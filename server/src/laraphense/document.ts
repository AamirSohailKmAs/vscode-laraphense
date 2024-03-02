'use strict';

import { DocumentUri } from 'vscode-languageserver';
import { Debounce } from '../support/debounce';

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
    public createdAt: number;
    public lastCompile: [number, number] = [0, 0];
    compileDebounce?: Debounce<unknown, unknown>;
    diagnoseDebounce?: Debounce<unknown, unknown>;
    constructor(
        public uri: DocumentUri,
        public languageId: DocLang,
        public version: number,
        public content: string,
        public isOpened: boolean = false,
        createdAt?: number
    ) {
        this.createdAt = createdAt ?? Date.now();
        this.lastCompile = process.hrtime();
    }
}

