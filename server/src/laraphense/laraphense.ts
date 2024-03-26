'use strict';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Workspace } from './indexing/workspace';
import { EMPTY_COMPLETION_LIST } from '../support/defaults';
import { doComplete } from '@vscode/emmet-helper';
import {
    CompletionContext,
    CompletionItem,
    CompletionList,
    DocumentLink,
    Position,
    SymbolInformation,
} from 'vscode-languageserver';
import { pushAll } from '../helpers/general';
import { MemoryCache } from '../support/cache';
import { DocLang, Regions } from './document';

import { getCSSLanguageService } from 'vscode-css-languageservice';
import { getLanguageService as getHTMLLanguageService } from 'vscode-html-languageservice';
import { Html } from '../languages/htmlLang';
import { Css } from '../languages/cssLang';
import { Language, Settings, laraphenseRc } from '../languages/baseLang';
import { Js } from '../languages/jsLang';
import { Blade } from '../languages/bladeLang';
import { Php } from '../languages/phpLang';

export class Laraphense {
    private _openDocuments: MemoryCache<Regions>;
    private _languages: Map<DocLang, Language> = new Map();
    private _settings: Settings = {};
    private _config: laraphenseRc;

    constructor(private _workspace: Workspace) {
        this._config = _workspace.config;
        this._openDocuments = new MemoryCache((doc) => this._workspace.getRegions(doc));

        const htmlLang = new Html(getHTMLLanguageService(), this._settings);

        this._languages.set(DocLang.html, htmlLang);
        this._languages.set(DocLang.php, new Php(_workspace));
        this._languages.set(DocLang.blade, new Blade(htmlLang));
        this._languages.set(DocLang.js, new Js(this._openDocuments, DocLang.js, this._settings));
        this._languages.set(DocLang.css, new Css(getCSSLanguageService(), this._openDocuments, this._settings));
    }

    public get config(): laraphenseRc {
        return this._config;
    }

    public set settings(settings: Settings) {
        this._settings = settings;
        if (settings.laraphense) {
            this._workspace.config = settings.laraphense;
        }
    }

    public async provideCompletion(
        document: TextDocument,
        position: Position,
        _context: CompletionContext | undefined
    ) {
        let result: CompletionList = EMPTY_COMPLETION_LIST;

        const lang = this.getLangAtPosition(document, position);

        if (!lang) {
            return result;
        }

        const folder = this._workspace.findFolderContainingUri(document.uri);
        if (folder) {
            folder.libraries.forEach((library) => {
                if (library.doComplete && library.canComplete(lang.id)) {
                    result = mergeCompletionItems(result, library.doComplete(document, position));
                }
            });
        }

        if (!lang.doComplete) {
            return result;
        }

        const items = await lang.doComplete(document, position, this._workspace.getDocumentContext(document.uri));
        result = mergeCompletionItems(result, items);
        if (result.items.length > 0) {
            return result;
        }

        if (lang.emmetSyntax) {
            const emmetResult = doComplete(document, position, lang.emmetSyntax, {});
            if (emmetResult) {
                result = mergeCompletionItems(result, emmetResult);
            }
        }

        return result;
    }

    public provideCompletionResolve(document: TextDocument, item: CompletionItem) {
        let data = item.data;
        if (data && data.languageId) {
            let lang = this.getLanguage(data.languageId);
            if (lang && lang.doResolve && document) {
                return lang.doResolve(document, item);
            }
        }
        return item;
    }

    public provideDocumentSymbol(document: TextDocument) {
        let symbols: SymbolInformation[] = [];

        this.getAllLanguagesInDocument(document).forEach((m) => {
            if (m.findDocumentSymbols) {
                let found = m.findDocumentSymbols(document);
                if (m.id === DocLang.html && found.length === 1 && found[0].name === '?') {
                    found = [];
                }

                pushAll(symbols, found);
            }
        });

        return symbols;
    }

    public provideDocumentLinks(document: TextDocument) {
        let documentContext = this._workspace.getDocumentContext(document.uri);
        const links: DocumentLink[] = [];
        this.getAllLanguagesInDocument(document).forEach((m) => {
            if (m.findDocumentLinks) {
                pushAll(links, m.findDocumentLinks(document, documentContext));
            }
        });
        return links;
    }

    public provideSignatureHelp(document: TextDocument, position: Position) {
        const lang = this.getLangAtPosition(document, position);
        if (!lang || !lang.doSignatureHelp) {
            return null;
        }
        return lang.doSignatureHelp(document, position);
    }

    public provideReferences(document: TextDocument, position: Position) {
        const lang = this.getLangAtPosition(document, position);
        if (!lang || !lang.findReferences) {
            return [];
        }

        const references = lang.findReferences(document, position);

        console.log('references', references);

        return references;
    }

    public provideDefinition(document: TextDocument, position: Position) {
        const lang = this.getLangAtPosition(document, position);
        if (!lang || !lang.findDefinition) {
            return [];
        }
        return lang.findDefinition(document, position);
    }

    public provideDocumentHighlight(document: TextDocument, position: Position) {
        const lang = this.getLangAtPosition(document, position);
        if (!lang || !lang.findDocumentHighlight) {
            return [];
        }
        return lang.findDocumentHighlight(document, position);
    }

    public provideHover(document: TextDocument, position: Position) {
        const lang = this.getLangAtPosition(document, position);
        if (!lang || !lang.doHover) {
            return null;
        }
        return lang.doHover(document, position);
    }

    public getLangAtPosition(document: TextDocument, position: Position) {
        const docLang = this._openDocuments.get(document).docLangAtOffset(document.offsetAt(position));
        console.log('docLang', docLang);
        return this.getLanguage(docLang);
    }

    public getAllLanguagesInDocument(document: TextDocument): Language[] {
        const result = [];
        for (const languageId of this._openDocuments.get(document).docLangsInDocument(this._languages.size)) {
            const mode = this._languages.get(languageId);
            if (mode) {
                result.push(mode);
            }
        }
        return result;
    }

    public getLanguage(languageId: DocLang): Language | undefined {
        return this._languages.get(languageId);
    }

    public documentOpened(openUri: TextDocument[]) {
        this._openDocuments.setOpenUris(openUri);
    }

    public documentChanged(document: TextDocument) {
        this._openDocuments.set(document);
    }

    public documentClosed(document: TextDocument) {
        this._openDocuments.delete(document.uri);
        this._languages.forEach((language) => {
            language.onDocumentRemoved(document);
        });
    }

    public shutdown() {
        this._openDocuments.clear();
        this._languages.forEach((lang) => {
            lang.dispose();
        });
        this._languages.clear();
    }
}

function mergeCompletionItems(list1: CompletionList, list2: CompletionList) {
    const items = list1.items;
    pushAll(items, list2.items);
    list1.items = items;
    return list1;
}

