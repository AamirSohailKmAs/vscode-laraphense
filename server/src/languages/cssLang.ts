/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { DocumentContext, LanguageService, Stylesheet } from 'vscode-css-languageservice';
import { Language, Settings } from './baseLang';
import { DocLang, FlatDocument, Regions } from '../laraphense/document';
import { MemoryCache } from '../support/cache';
import { Color, CompletionList, Diagnostic, Position, Range } from 'vscode-languageserver';

export const CSS_STYLE_RULE = '__';

export class Css implements Language {
    id: DocLang = DocLang.css;
    emmetSyntax?: 'html' | 'css' = 'css';
    cssStylesheets: MemoryCache<Stylesheet>;
    embeddedCSSDocuments: MemoryCache<FlatDocument>;
    constructor(
        private service: LanguageService,
        private documentRegions: MemoryCache<Regions>,
        private settings: Settings
    ) {
        this.embeddedCSSDocuments = new MemoryCache((document) =>
            this.documentRegions.get(document).getEmbeddedDocument(document, this.id)
        );
        this.cssStylesheets = new MemoryCache((document) => service.parseStylesheet(document.doc));
    }

    async doValidation(document: FlatDocument) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.doValidation(
            embedded.doc,
            this.cssStylesheets.get(embedded),
            this.settings && this.settings.css
        ) as Diagnostic[];
    }

    async doComplete(document: FlatDocument, position: Position, documentContext: DocumentContext) {
        const embedded = this.embeddedCSSDocuments.get(document);
        const stylesheet = this.cssStylesheets.get(embedded);
        return (
            this.service.doComplete2(
                embedded.doc,
                position,
                stylesheet,
                documentContext,
                this.settings?.css?.completion
            ) || CompletionList.create()
        );
    }
    doHover(document: FlatDocument, position: Position) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.doHover(
            embedded.doc,
            position,
            this.cssStylesheets.get(embedded),
            this.settings?.css?.hover
        );
    }
    findDocumentHighlight(document: FlatDocument, position: Position) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.findDocumentHighlights(embedded.doc, position, this.cssStylesheets.get(embedded));
    }
    findDocumentSymbols(document: FlatDocument) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service
            .findDocumentSymbols(embedded.doc, this.cssStylesheets.get(embedded))
            .filter((s) => s.name !== CSS_STYLE_RULE);
    }
    findDefinition(document: FlatDocument, position: Position) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.findDefinition(embedded.doc, position, this.cssStylesheets.get(embedded));
    }
    findReferences(document: FlatDocument, position: Position) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.findReferences(embedded.doc, position, this.cssStylesheets.get(embedded));
    }
    findDocumentColors(document: FlatDocument) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.findDocumentColors(embedded.doc, this.cssStylesheets.get(embedded));
    }
    getColorPresentations(document: FlatDocument, color: Color, range: Range) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.getColorPresentations(embedded.doc, this.cssStylesheets.get(embedded), color, range);
    }
    getFoldingRanges(document: FlatDocument) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.getFoldingRanges(embedded.doc, {});
    }
    getSelectionRange(document: FlatDocument, position: Position) {
        const embedded = this.embeddedCSSDocuments.get(document);
        return this.service.getSelectionRanges(embedded.doc, [position], this.cssStylesheets.get(embedded))[0];
    }
    onDocumentRemoved(document: FlatDocument) {
        this.embeddedCSSDocuments.delete(document.doc.uri);
        this.cssStylesheets.delete(document.doc.uri);
    }
    dispose() {
        this.embeddedCSSDocuments.clear();
        this.cssStylesheets.clear();
    }
}

