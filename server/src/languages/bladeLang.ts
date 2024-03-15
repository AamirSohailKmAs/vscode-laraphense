'use strict';

import { FoldingRange, FormattingOptions, Position, Range, SelectionRange } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentContext } from 'vscode-html-languageservice';
import { Language } from './baseLang';
import { DocLang } from '../laraphense/document';
import { Html } from './htmlLang';

export class Blade implements Language {
    id: DocLang = DocLang.blade;
    emmetSyntax?: 'html' | 'css' = 'html';

    constructor(private html: Html) {}

    getSelectionRange(document: TextDocument, position: Position): SelectionRange {
        return this.html.getSelectionRange(document, position);
    }

    async doComplete(document: TextDocument, position: Position, documentContext: DocumentContext) {
        const completionList = this.html.doComplete(document, position, documentContext);
        return completionList;
    }

    doHover(document: TextDocument, position: Position) {
        return this.html.doHover(document, position);
    }

    findDocumentHighlight(document: TextDocument, position: Position) {
        return this.html.findDocumentHighlight(document, position);
    }

    findDocumentLinks(document: TextDocument, documentContext: DocumentContext) {
        return this.html.findDocumentLinks(document, documentContext);
    }

    findDocumentSymbols(document: TextDocument) {
        return this.html.findDocumentSymbols(document);
    }

    format(document: TextDocument, range: Range, formatParams: FormattingOptions) {
        return this.html.format(document, range, formatParams);
    }

    getFoldingRanges(document: TextDocument): FoldingRange[] {
        return this.html.getFoldingRanges(document);
    }

    doAutoInsert(document: TextDocument, position: Position, kind: 'autoQuote' | 'autoClose') {
        return this.html.doAutoInsert(document, position, kind);
    }

    doRename(document: TextDocument, position: Position, newName: string) {
        return this.html.doRename(document, position, newName);
    }

    findMatchingTagPosition(document: TextDocument, position: Position) {
        return this.html.findMatchingTagPosition(document, position);
    }

    doLinkedEditing(document: TextDocument, position: Position) {
        return this.html.doLinkedEditing(document, position);
    }

    onDocumentRemoved(document: TextDocument) {
        this.html.onDocumentRemoved(document);
    }

    dispose() {
        this.html.dispose();
    }
}

