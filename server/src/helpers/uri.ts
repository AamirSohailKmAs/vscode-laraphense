'use strict';
import { URI } from 'vscode-uri';
import { DocLang } from '../support/document';

export function pathToUri(path: string) {
    return URI.file(path).toString();
}

export function uriToPath(uri: string) {
    return URI.parse(uri).fsPath;
}

export function getUriScheme(uri: string) {
    const t = uri.indexOf(':');
    if (t > -1) {
        return uri.slice(0, t);
    } else {
        return '';
    }
}

export function folderContainsUri(folder: string, uri: string) {
    return uri.indexOf(folder) === 0;
}

export function guessLangFromUri(uri: string) {
    if (uri.endsWith('.blade.php')) {
        return DocLang.blade;
    }
    if (uri.endsWith('.php')) {
        return DocLang.php;
    }
    if (uri.endsWith('.json')) {
        return DocLang.json;
    }
    return DocLang.unknown;
}

export function toDocLang(languageId: string) {
    switch (languageId.toLowerCase()) {
        case 'blade':
            return DocLang.blade;
        case 'php':
            return DocLang.php;
        case 'json':
            return DocLang.json;
        case 'css':
            return DocLang.css;
        case 'js':
            return DocLang.js;
        case 'ts':
            return DocLang.ts;
        case 'html':
            return DocLang.html;
        default:
            return DocLang.unknown;
    }
}

