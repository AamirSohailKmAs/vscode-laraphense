'use strict';

import { FoldingRange, FormattingOptions, Position, Range, SelectionRange } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentContext } from 'vscode-html-languageservice';
import { Language } from './baseLang';
import { DocLang } from '../laraphense/document';
import { Html } from './htmlLang';

export class Blade implements Language {
    public id: DocLang = DocLang.blade;
    public emmetSyntax?: 'html' | 'css' = 'html';

    constructor(private html: Html) {}

    public getSelectionRange(document: TextDocument, position: Position): SelectionRange {
        return this.html.getSelectionRange(document, position);
    }

    public async doComplete(document: TextDocument, position: Position, documentContext: DocumentContext) {
        const completionList = this.html.doComplete(document, position, documentContext);
        return completionList;
    }

    public doHover(document: TextDocument, position: Position) {
        return this.html.doHover(document, position);
    }

    public findDocumentHighlight(document: TextDocument, position: Position) {
        return this.html.findDocumentHighlight(document, position);
    }

    public findDocumentLinks(document: TextDocument, documentContext: DocumentContext) {
        return this.html.findDocumentLinks(document, documentContext);
    }

    public findDocumentSymbols(document: TextDocument) {
        return this.html.findDocumentSymbols(document);
    }

    public format(document: TextDocument, range: Range, formatParams: FormattingOptions) {
        return this.html.format(document, range, formatParams);
    }

    public getFoldingRanges(document: TextDocument): FoldingRange[] {
        return this.html.getFoldingRanges(document);
    }

    public doAutoInsert(document: TextDocument, position: Position, kind: 'autoQuote' | 'autoClose') {
        return this.html.doAutoInsert(document, position, kind);
    }

    public doRename(document: TextDocument, position: Position, newName: string) {
        return this.html.doRename(document, position, newName);
    }

    public findMatchingTagPosition(document: TextDocument, position: Position) {
        return this.html.findMatchingTagPosition(document, position);
    }

    public doLinkedEditing(document: TextDocument, position: Position) {
        return this.html.doLinkedEditing(document, position);
    }

    public onDocumentRemoved(document: TextDocument) {
        this.html.onDocumentRemoved(document);
    }

    public dispose() {
        this.html.dispose();
    }
}

