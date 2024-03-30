'use strict';

import { FoldingRange, FormattingOptions, Position, Range, SelectionRange } from 'vscode-languageserver';
import { DocumentContext } from 'vscode-html-languageservice';
import { Language } from './baseLang';
import { DocLang, FlatDocument } from '../laraphense/document';
import { Html } from './htmlLang';

export class Blade implements Language {
    public id: DocLang = DocLang.blade;
    public emmetSyntax?: 'html' | 'css' = 'html';

    constructor(private html: Html) {}

    public getSelectionRange(document: FlatDocument, position: Position): SelectionRange {
        return this.html.getSelectionRange(document, position);
    }

    public async doComplete(document: FlatDocument, position: Position, documentContext: DocumentContext) {
        const completionList = this.html.doComplete(document, position, documentContext);
        return completionList;
    }

    public doHover(document: FlatDocument, position: Position) {
        return this.html.doHover(document, position);
    }

    public findDocumentHighlight(document: FlatDocument, position: Position) {
        return this.html.findDocumentHighlight(document, position);
    }

    public findDocumentLinks(document: FlatDocument, documentContext: DocumentContext) {
        return this.html.findDocumentLinks(document, documentContext);
    }

    public findDocumentSymbols(document: FlatDocument) {
        return this.html.findDocumentSymbols(document);
    }

    public format(document: FlatDocument, range: Range, formatParams: FormattingOptions) {
        return this.html.format(document, range, formatParams);
    }

    public getFoldingRanges(document: FlatDocument): FoldingRange[] {
        return this.html.getFoldingRanges(document);
    }

    public doAutoInsert(document: FlatDocument, position: Position, kind: 'autoQuote' | 'autoClose') {
        return this.html.doAutoInsert(document, position, kind);
    }

    public doRename(document: FlatDocument, position: Position, newName: string) {
        return this.html.doRename(document, position, newName);
    }

    public findMatchingTagPosition(document: FlatDocument, position: Position) {
        return this.html.findMatchingTagPosition(document, position);
    }

    public doLinkedEditing(document: FlatDocument, position: Position) {
        return this.html.doLinkedEditing(document, position);
    }

    public onDocumentRemoved(document: FlatDocument) {
        this.html.onDocumentRemoved(document);
    }

    public dispose() {
        this.html.dispose();
    }
}

