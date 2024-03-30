'use strict';

import { BladeParser } from '../bladeParser/parser';
import { DocLang, FlatDocument } from './document';
import { Analyser } from '../languages/php/indexing/analyser';
import { laraphenseRc } from '../languages/baseLang';
import { Tree, newAstTree } from '../bladeParser/bladeAst';
import { TextDocument } from 'vscode-languageserver-textdocument';

export class Compiler {
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

    public parseDoc(doc: TextDocument): Tree {
        return this.parseFlatDoc(FlatDocument.fromTextDocument(doc));
    }

    public compileUri(flatDoc: FlatDocument) {
        const astTree = this.parseFlatDoc(flatDoc);

        const { symbols } = this._analyser.analyse(astTree);

        flatDoc.lastCompile = process.hrtime();

        return { astTree, symbols };
    }

    private parseFlatDoc(flatDoc: FlatDocument): Tree {
        if (DocLang.php !== flatDoc.languageId && DocLang.blade !== flatDoc.languageId) {
            return newAstTree();
        }

        try {
            return this._bladeParser.parse(flatDoc.doc, flatDoc.languageId);
        } catch (error) {
            return newAstTree();
        }
    }
}

