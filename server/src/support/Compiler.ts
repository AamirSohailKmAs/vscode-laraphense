'use strict';

import { BladeParser, Tree, newAstTree } from '@porifa/blade-parser';
import { MemoryCache } from './cache';
import { DocLang, ASTDocument, Regions } from './document';
import { laraphenseRc } from '../languages/baseLang';
import { DocumentUri, TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { guessLangFromUri } from '../helpers/uri';

export class Compiler {
    public regionsMap: MemoryCache<Regions>;

    private _parser: BladeParser;
    private _docMap = new Map<DocumentUri, ASTDocument>();

    constructor(config: laraphenseRc) {
        this._parser = new BladeParser(config.phpVersion);
        this.regionsMap = new MemoryCache((doc) => new Regions(doc.uri).parse(parseDoc(this._parser, doc)));
    }

    public getDoc(uri: string) {
        return this._docMap.get(uri);
    }

    public OpenDoc(uri: string, version: number, text: string) {
        const doc: ASTDocument = new ASTDocument(uri, guessLangFromUri(uri), version, text, true);

        this._docMap.set(uri, doc);
        this.regionsMap.set(doc);
    }

    public closeDoc(uri: string) {
        this._docMap.delete(uri);
        this.regionsMap.delete(uri);
    }

    updateDoc(uri: string, version: number, changes: TextDocumentContentChangeEvent[]) {
        const doc = this._docMap.get(uri);

        if (!doc) {
            console.log(`can't update doc having uri: ${uri}`);

            return;
        }

        doc.update(changes, version);
        this.regionsMap.set(doc);
    }

    shutdown() {
        this._docMap.clear();
        this.regionsMap.clear();
    }

    public getRegions(uri: string): Regions {
        const doc = this._docMap.get(uri);
        if (!doc) {
            return new Regions(uri);
        }
        return this.regionsMap.get(doc);
    }
}

export function parseDoc(parser: BladeParser, doc: ASTDocument): Tree {
    if (DocLang.php !== doc.languageId && DocLang.blade !== doc.languageId) {
        return newAstTree();
    }

    try {
        return parser.parse(doc.getText(), doc.languageId);
    } catch (error) {
        console.log(error);
        return newAstTree();
    }
}

