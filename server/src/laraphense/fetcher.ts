'use strict';

import { existsSync, readFileSync } from 'fs';
import { guessLangFromUri, uriToPath } from '../helpers/uri';
import { DocumentUri } from 'vscode-languageserver-textdocument';
import { DocLang, FlatDocument } from './document';

export class Fetcher {
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

        return new FlatDocument(uri, lang, 0, content);
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

