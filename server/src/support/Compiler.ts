'use strict';

import { BladeParser, Tree, newAstTree } from '@porifa/blade-parser';
import { DocLang, ASTDocument, Regions } from './document';
import { laraphenseRc } from '../languages/baseLang';
import { DocumentUri, TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { guessLangFromUri } from '../helpers/uri';
import { Debounce } from './debounce';

export class Compiler {
    private _regions = new Regions();

    private _parser: BladeParser;
    private _docMap = new Map<DocumentUri, ASTDocument>();

    constructor(config: laraphenseRc) {
        this._parser = new BladeParser(config.phpVersion);
    }

    public get regions(): Regions {
        return this._regions;
    }

    public getDoc(uri: string) {
        return this._docMap.get(uri);
    }

    public OpenDoc(uri: string, version: number, text: string) {
        let compileDebounce = new Debounce<TextDocumentContentChangeEvent[], boolean>((t) => {
            return this.compileDebounce(t, doc);
        }, 250);

        const doc: ASTDocument = new ASTDocument(uri, guessLangFromUri(uri), version, text, true, compileDebounce);

        this._docMap.set(uri, doc);
        this.regions.set(uri, parseDoc(this._parser, doc).children);
    }

    public closeDoc(uri: string) {
        this._docMap.delete(uri);
        this.regions.delete(uri);
    }
    updateDoc(uri: string, version: number, changes: TextDocumentContentChangeEvent[]) {
        const doc = this._docMap.get(uri);

        if (!doc) {
            console.log(`can't update doc having uri: ${uri}`);

            return;
        }

        doc.update(changes, version);

        if (doc.diagnoseDebounce) {
            doc.diagnoseDebounce.clear();
        }

        if (doc.compileDebounce) {
            doc.compileDebounce.handle(changes);
        }
        this.regions.set(uri, parseDoc(this._parser, doc).children);
    }

    shutdown() {
        this._docMap.clear();
        this.regions.clear();
    }

    private compile(doc: ASTDocument, steps: number): boolean {
        return false;
    }

    private compileDebounce(t: TextDocumentContentChangeEvent[][], doc: ASTDocument) {
        if (!t) {
            return false;
        }
        let isCompiled = this.compile(doc, 3);
        doc.lastCompile = process.hrtime();
        if (doc.diagnoseDebounce) {
            doc.diagnoseDebounce.handle();
        }
        return isCompiled;
    }

    public isReady(uri: string) {
        const doc = this._docMap.get(uri);
        if (doc && doc.compileDebounce) {
            return doc.compileDebounce.flush(true);
        }
        return false;
    }
}

export function parseDoc(parser: BladeParser, doc: ASTDocument): Tree {
    if (DocLang.php !== doc.languageId && DocLang.blade !== doc.languageId) {
        return newAstTree();
    }

    try {
        return parser.parse(doc.getText(), doc.languageId);
    } catch (error) {
        return newAstTree();
    }
}

