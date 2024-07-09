'use strict';

import { BladeParser } from '../bladeParser/parser';
import { DocLang, FlatDocument } from './document';
import { Analyser } from '../languages/php/indexing/analyser';
import { laraphenseRc } from '../languages/baseLang';
import { Tree, newAstTree } from '../bladeParser/bladeAst';
import { DocumentUri, TextDocumentContentChangeEvent } from 'vscode-languageserver';

export class Compiler {
    _loadedDocuments: Map<DocumentUri, FlatDocument> = new Map();
    private _analyser: Analyser;
    private _bladeParser: BladeParser;

    constructor(public config: laraphenseRc) {
        this._analyser = new Analyser();
        this._bladeParser = new BladeParser({
            parser: { extractDoc: true, suppressErrors: true, version: config.phpVersion },
            ast: { withPositions: true },
            lexer: { short_tags: true },
        });
    }

    public parseFlatDoc(flatDoc: FlatDocument): Tree {
        if (DocLang.php !== flatDoc.languageId && DocLang.blade !== flatDoc.languageId) {
            return newAstTree();
        }

        try {
            return this._bladeParser.parse(flatDoc, flatDoc.languageId);
        } catch (error) {
            return newAstTree();
        }
    }

    public compileUri(flatDoc: FlatDocument) {
        const astTree = this.parseFlatDoc(flatDoc);

        const { symbols, references } = this._analyser.analyse(astTree);

        flatDoc.lastCompile = process.hrtime();

        return { astTree, symbols, references };
    }
}

