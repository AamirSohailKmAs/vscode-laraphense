'use strict';

import { existsSync, readFileSync } from 'fs';
import { guessLangFromUri, uriToPath } from '../helpers/uri';
import { DocumentUri } from 'vscode-languageserver-textdocument';
import { DocLang, ASTDocument } from './document';
import { RelativeUri } from './workspaceFolder';
import { join } from 'path';

export class Fetcher {
    constructor(private _uri: string) {}

    public loadRelativeUriIfLang(uri: RelativeUri, allowedLanguage: DocLang[]) {
        return this.loadUriIfLang(join(this._uri, uri), allowedLanguage);
    }

    public loadUriIfLang(uri: DocumentUri, allowedLanguage: DocLang[]) {
        const lang = guessLangFromUri(uri);

        if (!allowedLanguage.includes(lang)) {
            // console.log(`${lang} of uri ${uri} is not allowed. while allowed list is ${allowedLanguage.toString()}`);

            return undefined;
        }

        const content = this.getFileContent(uri);

        if (content === undefined) {
            console.log(`Content of file having uri [${uri}] doesn't exists`);

            return undefined;
        }

        return new ASTDocument(uri, lang, 1, content);
    }

    public getFileContent(uri: string) {
        const path = uriToPath(uri);

        if (!existsSync(path)) {
            console.log(`path [${path}] doesn't exists while uri is [${uri}]`);
            return undefined;
        }

        return readFileSync(path, { encoding: 'utf-8' }).toString();
    }
}

