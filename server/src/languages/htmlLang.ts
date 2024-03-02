import { Position } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageService } from 'vscode-html-languageservice';
import { Language } from './baseLang';
import { DocLang } from '../laraphense/document';

export class Html extends Language {
    constructor(private service: LanguageService) {
        super(DocLang.html, 'html');
    }

    doComplete(document: TextDocument, position: Position) {
        const htmlDoc = this.service.parseHTMLDocument(document);
        return this.service.doComplete(document, position, htmlDoc);
    }
    onDocumentRemoved(_document: TextDocument) {
        /* nothing to do */
    }
    dispose() {
        /* nothing to do */
    }
}

