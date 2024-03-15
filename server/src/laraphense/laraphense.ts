'use strict';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Workspace } from './indexing/workspace';
import { EMPTY_COMPLETION_LIST } from '../support/defaults';
import { doComplete as emmetDoComplete } from '@vscode/emmet-helper';
import {
    CompletionContext,
    CompletionItem,
    CompletionList,
    DocumentLink,
    Position,
    SymbolInformation,
} from 'vscode-languageserver';
import { pushAll } from '../helpers/general';

export class Laraphense {
    constructor(private _workspace: Workspace) {}

    public async provideCompletion(
        document: TextDocument,
        position: Position,
        _context: CompletionContext | undefined
    ) {
        const lang = this._workspace.getLangAtPosition(document, position);
        let result: CompletionList | undefined = EMPTY_COMPLETION_LIST;

        if (!lang || !lang.doComplete) {
            return result;
        }

        result = await lang.doComplete(document, position, this._workspace.getDocumentContext(document.uri));
        if (result.items.length > 0) {
            return result;
        }

        if (lang.emmetSyntax) {
            result = emmetDoComplete(document, position, lang.emmetSyntax, {});
        }

        return result;
    }

    public provideCompletionResolve(document: TextDocument, item: CompletionItem) {
        let data = item.data;
        if (data && data.languageId) {
            let lang = this._workspace.getLanguage(data.languageId);
            if (lang && lang.doResolve && document) {
                return lang.doResolve(document, item);
            }
        }
        return item;
    }

    public provideDocumentSymbol(document: TextDocument) {
        let symbols: SymbolInformation[] = [];
        this._workspace.getAllLanguagesInDocument(document).forEach((m) => {
            if (m.findDocumentSymbols) {
                pushAll(symbols, m.findDocumentSymbols(document));
            }
        });
        return symbols;
    }

    public provideDocumentLinks(document: TextDocument) {
        let documentContext = this._workspace.getDocumentContext(document.uri);
        const links: DocumentLink[] = [];
        this._workspace.getAllLanguagesInDocument(document).forEach((m) => {
            if (m.findDocumentLinks) {
                pushAll(links, m.findDocumentLinks(document, documentContext));
            }
        });
        return links;
    }

    public provideSignatureHelp(document: TextDocument, position: Position) {
        let lang = this._workspace.getLangAtPosition(document, position);
        if (!lang || !lang.doSignatureHelp) {
            return null;
        }
        return lang.doSignatureHelp(document, position);
    }

    public provideReferences(document: TextDocument, position: Position) {
        let lang = this._workspace.getLangAtPosition(document, position);
        if (!lang || !lang.findReferences) {
            return [];
        }
        return lang.findReferences(document, position);
    }

    public provideDefinition(document: TextDocument, position: Position) {
        let lang = this._workspace.getLangAtPosition(document, position);
        if (!lang || !lang.findDefinition) {
            return [];
        }
        return lang.findDefinition(document, position);
    }

    public provideDocumentHighlight(document: TextDocument, position: Position) {
        let lang = this._workspace.getLangAtPosition(document, position);
        if (!lang || !lang.findDocumentHighlight) {
            return [];
        }
        return lang.findDocumentHighlight(document, position);
    }

    public provideHover(document: TextDocument, position: Position) {
        let lang = this._workspace.getLangAtPosition(document, position);
        if (!lang || !lang.doHover) {
            return null;
        }
        return lang.doHover(document, position);
    }
}

