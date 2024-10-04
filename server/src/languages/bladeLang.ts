'use strict';

import { FoldingRange, FormattingOptions, Position, Range, SelectionRange } from 'vscode-languageserver';
import { DocumentContext } from 'vscode-html-languageservice';
import { Language } from './baseLang';
import { DocLang, ASTDocument } from '../support/document';
import { Html } from './htmlLang';

export class Blade implements Language {
    public id: DocLang = DocLang.blade;
    public emmetSyntax?: 'html' | 'css' = 'html';

    constructor(private html: Html) {}

    public getSelectionRange(document: ASTDocument, position: Position): SelectionRange {
        return this.html.getSelectionRange(document, position);
    }

    public async doComplete(document: ASTDocument, position: Position, documentContext: DocumentContext) {
        const completionList = this.html.doComplete(document, position, documentContext);
        return completionList;
    }

    public doHover(document: ASTDocument, position: Position) {
        return this.html.doHover(document, position);
    }

    public findDocumentHighlight(document: ASTDocument, position: Position) {
        return this.html.findDocumentHighlight(document, position);
    }

    public findDocumentLinks(document: ASTDocument, documentContext: DocumentContext) {
        return this.html.findDocumentLinks(document, documentContext);
    }

    public findDocumentSymbols(document: ASTDocument) {
        return this.html.findDocumentSymbols(document);
    }

    public format(document: ASTDocument, range: Range, formatParams: FormattingOptions) {
        return this.html.format(document, range, formatParams);
    }

    public getFoldingRanges(document: ASTDocument): FoldingRange[] {
        return this.html.getFoldingRanges(document);
    }

    public doAutoInsert(document: ASTDocument, position: Position, kind: 'autoQuote' | 'autoClose') {
        return this.html.doAutoInsert(document, position, kind);
    }

    public doRename(document: ASTDocument, position: Position, newName: string) {
        return this.html.doRename(document, position, newName);
    }

    public findMatchingTagPosition(document: ASTDocument, position: Position) {
        return this.html.findMatchingTagPosition(document, position);
    }

    public doLinkedEditing(document: ASTDocument, position: Position) {
        return this.html.doLinkedEditing(document, position);
    }

    public onDocumentRemoved(document: ASTDocument) {
        this.html.onDocumentRemoved(document);
    }

    public dispose() {
        this.html.dispose();
    }
}

