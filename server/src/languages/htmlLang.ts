import {
    CompletionItem,
    Definition,
    Diagnostic,
    FoldingRange,
    FormattingOptions,
    Location,
    Position,
    Range,
    SelectionRange,
    SignatureHelp,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentContext, HTMLDocument, HTMLFormatConfiguration, LanguageService } from 'vscode-html-languageservice';
import { Language, Settings } from './baseLang';
import { DocLang } from '../laraphense/document';
import { MemoryCache } from '../support/cache';

export class Html implements Language {
    id: DocLang = DocLang.html;
    emmetSyntax?: 'html' | 'css' = 'html';
    htmlDocuments: MemoryCache<HTMLDocument>;

    constructor(private service: LanguageService, private settings: Settings) {
        this.htmlDocuments = new MemoryCache((document) => service.parseHTMLDocument(document));
    }

    getSelectionRange(document: TextDocument, position: Position): SelectionRange {
        return this.service.getSelectionRanges(document, [position])[0];
    }

    async doComplete(document: TextDocument, position: Position, documentContext: DocumentContext) {
        const htmlSettings = this.settings?.html;
        const options = merge(htmlSettings?.suggest, {});
        options.hideAutoCompleteProposals = htmlSettings?.autoClosingTags === true;
        options.attributeDefaultValue = htmlSettings?.completion?.attributeDefaultValue ?? 'doublequotes';

        const htmlDocument = this.htmlDocuments.get(document);
        const completionList = this.service.doComplete2(document, position, htmlDocument, documentContext, options);
        return completionList;
    }
    doHover(document: TextDocument, position: Position) {
        return this.service.doHover(document, position, this.htmlDocuments.get(document), this.settings?.html?.hover);
    }
    findDocumentHighlight(document: TextDocument, position: Position) {
        return this.service.findDocumentHighlights(document, position, this.htmlDocuments.get(document));
    }
    findDocumentLinks(document: TextDocument, documentContext: DocumentContext) {
        return this.service.findDocumentLinks(document, documentContext);
    }
    findDocumentSymbols(document: TextDocument) {
        return this.service.findDocumentSymbols(document, this.htmlDocuments.get(document));
    }
    format(document: TextDocument, range: Range, formatParams: FormattingOptions) {
        const formatSettings: HTMLFormatConfiguration = merge(this.settings?.html?.format, {});
        if (formatSettings.contentUnformatted) {
            formatSettings.contentUnformatted = formatSettings.contentUnformatted + ',script';
        } else {
            formatSettings.contentUnformatted = 'script';
        }
        merge(formatParams, formatSettings);
        return this.service.format(document, range, formatSettings);
    }
    getFoldingRanges(document: TextDocument): FoldingRange[] {
        return this.service.getFoldingRanges(document);
    }
    doAutoInsert(document: TextDocument, position: Position, kind: 'autoQuote' | 'autoClose') {
        const offset = document.offsetAt(position);
        const text = document.getText();
        if (kind === 'autoQuote') {
            if (offset > 0 && text.charAt(offset - 1) === '=') {
                const htmlSettings = this.settings?.html;
                const options = merge(htmlSettings?.suggest, {});
                options.attributeDefaultValue = htmlSettings?.completion?.attributeDefaultValue ?? 'doublequotes';

                return this.service.doQuoteComplete(document, position, this.htmlDocuments.get(document), options);
            }
        } else if (kind === 'autoClose') {
            if (offset > 0 && text.charAt(offset - 1).match(/[>\/]/g)) {
                return this.service.doTagComplete(document, position, this.htmlDocuments.get(document));
            }
        }
        return null;
    }
    doRename(document: TextDocument, position: Position, newName: string) {
        const htmlDocument = this.htmlDocuments.get(document);
        return this.service.doRename(document, position, newName, htmlDocument);
    }

    findMatchingTagPosition(document: TextDocument, position: Position) {
        const htmlDocument = this.htmlDocuments.get(document);
        return this.service.findMatchingTagPosition(document, position, htmlDocument);
    }
    doLinkedEditing(document: TextDocument, position: Position) {
        const htmlDocument = this.htmlDocuments.get(document);
        return this.service.findLinkedEditingRanges(document, position, htmlDocument);
    }
    onDocumentRemoved(document: TextDocument) {
        this.htmlDocuments.delete(document.uri);
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

