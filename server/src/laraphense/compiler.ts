'use strict';

import { BladeParser } from '../bladeParser/parser';
import { DocLang, FlatDocument } from './document';
import { Fetcher } from './fetcher';
import { Analyser } from './analyser';
import { WorkspaceFolder } from './indexing/workspaceFolder';
import { laraphenseRc } from '../languages/baseLang';
import { Tree } from '../types/bladeAst';
import { TextDocument } from 'vscode-languageserver-textdocument';

export class Compiler {
    private _fetcher: Fetcher;
    private _analyser: Analyser;
    private _bladeParser: BladeParser;

    constructor(public config: laraphenseRc) {
        this._fetcher = new Fetcher();
        this._analyser = new Analyser();
        this._bladeParser = new BladeParser({
            parser: { extractDoc: true, suppressErrors: true, version: config.phpVersion },
            ast: { withPositions: true },
            lexer: { short_tags: true },
        });
    }

    public parseDoc(doc: TextDocument): Tree {
        return this.parseFlatDoc(FlatDocument.fromTextDocument(doc));
    }

    public compileUri(uri: string, folder: WorkspaceFolder) {
        const flatDoc = this._fetcher.loadUriIfLang(uri, [DocLang.php, DocLang.blade]);

        if (flatDoc === undefined) {
            return undefined;
        }

        const astTree = this.parseFlatDoc(flatDoc);

        const { symbols } = this._analyser.analyse(astTree);
        folder.symbolTable.addSymbolsFromMap(symbols, folder.relativePath(uri));

        flatDoc.lastCompile = process.hrtime();

        return { astTree };
    }

    private parseFlatDoc(flatDoc: FlatDocument): Tree {
        if (DocLang.php !== flatDoc.languageId && DocLang.blade !== flatDoc.languageId) {
            return this._bladeParser.newAstTree();
        }

        try {
            return this._bladeParser.parse(flatDoc.doc, flatDoc.languageId);
        } catch (error) {
            return this._bladeParser.newAstTree();
        }
    }
}

