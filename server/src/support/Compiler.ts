'use strict';

import { BladeParser, Tree, newAstTree } from '@porifa/blade-parser';
import { DocLang, ASTDocument, Regions } from './document';
import { DocumentUri, TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { guessLangFromUri } from '../helpers/uri';
import { Debounce } from './debounce';
import { Workspace } from './workspace';
import { Steps } from './Indexer';
import { Space } from './workspaceFolder';

export class Compiler {
    private _regions = new Regions();

    private _parser: BladeParser;
    private _docMap = new Map<DocumentUri, ASTDocument>();

    constructor(private workspace: Workspace) {
        this._parser = new BladeParser(workspace.config.phpVersion);
    }

    public get regions(): Regions {
        return this._regions;
    }

    public getDoc(uri: string) {
        return this._docMap.get(uri);
    }

    public OpenDoc(uri: string, version: number, text: string) {
        const space = this.workspace.getProjectSpace(uri);

        let compileDebounce = new Debounce<TextDocumentContentChangeEvent[]>((changes) => {
            if (changes.length === 0) {
                return;
            }
            this.compile(doc, Steps.Errors, space);

            if (doc.diagnoseDebounce) {
                doc.diagnoseDebounce.handle();
            }
        }, 250);

        const doc: ASTDocument = new ASTDocument(uri, guessLangFromUri(uri), version, text, true, compileDebounce);
        this._docMap.set(uri, doc);

        let ast = this.compile(doc, Steps.Errors, space);

        this.regions.set(uri, ast.children);
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

    private compile(doc: ASTDocument, steps: Steps, space?: Space): Tree {
        if (space) {
            return space.folder.indexer.compile(doc, space.fileUri, steps);
        }

        let ast = parseDoc(this._parser, doc);
        doc.lastCompile = process.hrtime();
        return ast;
    }

    public isReady(uri: string) {
        const doc = this._docMap.get(uri);
        if (doc && doc.compileDebounce) {
            return true;
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

