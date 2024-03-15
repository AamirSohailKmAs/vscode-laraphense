/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { DocumentContext, LanguageService, Stylesheet } from 'vscode-css-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Language, Settings } from './baseLang';
import { DocLang, Regions } from '../laraphense/document';
import { MemoryCache } from '../support/cache';
import { Color, CompletionList, Diagnostic, Position, Range } from 'vscode-languageserver';

export const CSS_STYLE_RULE = '__';

export class Css implements Language {
    id: DocLang = DocLang.css;
    emmetSyntax?: 'html' | 'css' = 'css';
    cssStylesheets: MemoryCache<Stylesheet>;
    embeddedCSSDocuments: MemoryCache<TextDocument>;
    constructor(
        private service: LanguageService,
        private documentRegions: MemoryCache<Regions>,
        private settings: Settings
    ) {
        this.embeddedCSSDocuments = new MemoryCache((document) =>
            this.documentRegions.get(document).getEmbeddedDocument(document, this.id)
        );
        this.cssStylesheets = new MemoryCache((document) => service.parseStylesheet(document));
    }

    async doValidation(document: TextDocument) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.doValidation(
            embedded,
            this.cssStylesheets.get(embedded),
            this.settings && this.settings.css
        ) as Diagnostic[];
    }

    async doComplete(document: TextDocument, position: Position, documentContext: DocumentContext) {
        const embedded = this.embeddedCSSDocuments.get(document);
        const stylesheet = this.cssStylesheets.get(embedded);
        return (
            this.service.doComplete2(embedded, position, stylesheet, documentContext, this.settings?.css?.completion) ||
            CompletionList.create()
        );
    }
    doHover(document: TextDocument, position: Position) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.doHover(embedded, position, this.cssStylesheets.get(embedded), this.settings?.css?.hover);
    }
    findDocumentHighlight(document: TextDocument, position: Position) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.findDocumentHighlights(embedded, position, this.cssStylesheets.get(embedded));
    }
    findDocumentSymbols(document: TextDocument) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service
            .findDocumentSymbols(embedded, this.cssStylesheets.get(embedded))
            .filter((s) => s.name !== CSS_STYLE_RULE);
    }
    findDefinition(document: TextDocument, position: Position) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.findDefinition(embedded, position, this.cssStylesheets.get(embedded));
    }
    findReferences(document: TextDocument, position: Position) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.findReferences(embedded, position, this.cssStylesheets.get(embedded));
    }
    findDocumentColors(document: TextDocument) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.findDocumentColors(embedded, this.cssStylesheets.get(embedded));
    }
    getColorPresentations(document: TextDocument, color: Color, range: Range) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.getColorPresentations(embedded, this.cssStylesheets.get(embedded), color, range);
    }
    getFoldingRanges(document: TextDocument) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.getFoldingRanges(embedded, {});
    }
    getSelectionRange(document: TextDocument, position: Position) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.getSelectionRanges(embedded, [position], this.cssStylesheets.get(embedded))[0];
    }
    onDocumentRemoved(document: TextDocument) {
        this.embeddedCSSDocuments.delete(document.uri);
        this.cssStylesheets.delete(document.uri);
    }
    dispose() {
        this.embeddedCSSDocuments.clear();
        this.cssStylesheets.clear();
    }
}

