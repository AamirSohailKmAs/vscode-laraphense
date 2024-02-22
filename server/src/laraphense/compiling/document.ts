'use strict';

import { DocumentUri } from 'vscode-languageserver';

export enum DocLang {
    html = 'html',
    css = 'css',
    js = 'js',
    json = 'json',
    php = 'php',
    blade = 'blade',
}

export class FlatDocument {
    createdAt: number;
    constructor(
        public uri: DocumentUri,
        public languageId: DocLang,
        public version: number,
        public content: string,
        createdAt?: number
    ) {
        this.createdAt = createdAt ?? Date.now();
    }
}

