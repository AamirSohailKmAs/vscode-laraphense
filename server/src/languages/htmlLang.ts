import { FoldingRange, FormattingOptions, Position, Range, SelectionRange } from 'vscode-languageserver';
import { DocumentContext, HTMLDocument, HTMLFormatConfiguration, LanguageService } from 'vscode-html-languageservice';
import { Language, Settings } from './baseLang';
import { DocLang, FlatDocument } from '../laraphense/document';
import { MemoryCache } from '../support/cache';

export class Html implements Language {
    id: DocLang = DocLang.html;
    emmetSyntax?: 'html' | 'css' = 'html';
    htmlDocuments: MemoryCache<HTMLDocument>;

    constructor(private service: LanguageService, private settings: Settings) {
        this.htmlDocuments = new MemoryCache((document) => service.parseHTMLDocument(document.doc));
    }

    getSelectionRange(document: FlatDocument, position: Position): SelectionRange {
        return this.service.getSelectionRanges(document.doc, [position])[0];
    }

    async doComplete(document: FlatDocument, position: Position, documentContext: DocumentContext) {
        const htmlSettings = this.settings?.html;
        const options = merge(htmlSettings?.suggest, {});
        options.hideAutoCompleteProposals = htmlSettings?.autoClosingTags === true;
        options.attributeDefaultValue = htmlSettings?.completion?.attributeDefaultValue ?? 'doublequotes';

        const htmlDocument = this.htmlDocuments.get(document);
        const completionList = this.service.doComplete2(document.doc, position, htmlDocument, documentContext, options);
        return completionList;
    }
    doHover(document: FlatDocument, position: Position) {
        return this.service.doHover(
            document.doc,
            position,
            this.htmlDocuments.get(document),
            this.settings?.html?.hover
        );
    }
    findDocumentHighlight(document: FlatDocument, position: Position) {
        return this.service.findDocumentHighlights(document.doc, position, this.htmlDocuments.get(document));
    }
    findDocumentLinks(document: FlatDocument, documentContext: DocumentContext) {
        return this.service.findDocumentLinks(document.doc, documentContext);
    }
    findDocumentSymbols(document: FlatDocument) {
        return this.service.findDocumentSymbols(document.doc, this.htmlDocuments.get(document));
    }
    format(document: FlatDocument, range: Range, formatParams: FormattingOptions) {
        const formatSettings: HTMLFormatConfiguration = merge(this.settings?.html?.format, {});
        if (formatSettings.contentUnformatted) {
            formatSettings.contentUnformatted = formatSettings.contentUnformatted + ',script';
        } else {
            formatSettings.contentUnformatted = 'script';
        }
        merge(formatParams, formatSettings);
        return this.service.format(document.doc, range, formatSettings);
    }
    getFoldingRanges(document: FlatDocument): FoldingRange[] {
        return this.service.getFoldingRanges(document.doc);
    }
    doAutoInsert(document: FlatDocument, position: Position, kind: 'autoQuote' | 'autoClose') {
        const offset = document.doc.offsetAt(position);
        const text = document.doc.getText();
        if (kind === 'autoQuote') {
            if (offset > 0 && text.charAt(offset - 1) === '=') {
                const htmlSettings = this.settings?.html;
                const options = merge(htmlSettings?.suggest, {});
                options.attributeDefaultValue = htmlSettings?.completion?.attributeDefaultValue ?? 'doublequotes';

                return this.service.doQuoteComplete(document.doc, position, this.htmlDocuments.get(document), options);
            }
        } else if (kind === 'autoClose') {
            if (offset > 0 && text.charAt(offset - 1).match(/[>\/]/g)) {
                return this.service.doTagComplete(document.doc, position, this.htmlDocuments.get(document));
            }
        }
        return null;
    }
    doRename(document: FlatDocument, position: Position, newName: string) {
        const htmlDocument = this.htmlDocuments.get(document);
        return this.service.doRename(document.doc, position, newName, htmlDocument);
    }

    findMatchingTagPosition(document: FlatDocument, position: Position) {
        const htmlDocument = this.htmlDocuments.get(document);
        return this.service.findMatchingTagPosition(document.doc, position, htmlDocument);
    }
    doLinkedEditing(document: FlatDocument, position: Position) {
        const htmlDocument = this.htmlDocuments.get(document);
        return this.service.findLinkedEditingRanges(document.doc, position, htmlDocument);
    }
    onDocumentRemoved(document: FlatDocument) {
        this.htmlDocuments.delete(document.doc.uri);
    }
    dispose() {
        this.htmlDocuments.clear();
    }
}

function merge(src: any, dst: any): any {
    if (src) {
        for (const key in src) {
            if (src.hasOwnProperty(key)) {
                dst[key] = src[key];
            }
        }
    }
    return dst;
}

