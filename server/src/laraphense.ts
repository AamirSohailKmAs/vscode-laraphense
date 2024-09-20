'use strict';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Workspace } from './support/workspace';
import { EMPTY_COMPLETION_LIST } from './support/defaults';
import { doComplete } from '@vscode/emmet-helper';
import {
    CompletionContext,
    CompletionItem,
    CompletionList,
    ConfigurationItem,
    DocumentLink,
    Position,
    SymbolInformation,
} from 'vscode-languageserver';
import { pushAll } from './helpers/general';
import { MemoryCache } from './support/cache';
import { DocLang, FlatDocument, Regions } from './support/document';

import { getCSSLanguageService } from 'vscode-css-languageservice';
import { getLanguageService as getHTMLLanguageService } from 'vscode-html-languageservice';
import { Html } from './languages/htmlLang';
import { Css } from './languages/cssLang';
import { Language, Settings } from './languages/baseLang';
import { Js } from './languages/jsLang';
import { Blade } from './languages/bladeLang';
import { Php } from './languages/phpLang';
import { FolderUri } from './support/workspaceFolder';
import { BladeParser, Tree, newAstTree } from '@porifa/blade-parser';

export class Laraphense {
    private _parser: BladeParser;
    private _settings: Settings = {};
    private _openDocuments: MemoryCache<Regions>;
    private _languages: Map<DocLang, Language> = new Map();

    constructor(private _workspace: Workspace) {
        this._parser = new BladeParser(this._workspace.config.phpVersion);
        this._openDocuments = new MemoryCache((doc) => this.getRegions(doc));

        const htmlLang = new Html(getHTMLLanguageService(), this._settings);
        const phpLang = new Php(_workspace);
        const bladeLang = new Blade(htmlLang);

        this._languages.set(DocLang.html, htmlLang);
        this._languages.set(DocLang.php, phpLang);
        this._languages.set(DocLang.blade, bladeLang);
        this._languages.set(DocLang.js, new Js(this._openDocuments, DocLang.js, this._settings));
        this._languages.set(DocLang.css, new Css(getCSSLanguageService(), this._openDocuments, this._settings));
    }

    public setSettings(items: ConfigurationItem[], settings: Settings) {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.scopeUri) {
                const folder = this._workspace.folders.get(item.scopeUri as FolderUri);
                if (folder) {
                    folder.config = settings[i];
                }
                continue;
            }

            if (item.section) {
                this._settings[item.section] = settings[i];
            }
        }

        if (settings.laraphense) {
            this._workspace.config = settings.laraphense;
        }
    }

    public async provideCompletion(
        document: FlatDocument,
        position: Position,
        _context: CompletionContext | undefined
    ) {
        let result: CompletionList = EMPTY_COMPLETION_LIST;

        const lang = this.getLangAtPosition(document, position);

        if (!lang) {
            return result;
        }

        const space = this._workspace.getProjectSpace(document.uri);
        if (space) {
            for (let i = 0; i < space.folder.libraries.length; i++) {
                const library = space.folder.libraries[i];
                if (library.doComplete) {
                    result = mergeCompletionItems(result, library.doComplete(lang.id, document, position));
                }
            }
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
            const emmetResult = doComplete(document.doc, position, lang.emmetSyntax, {});
            if (emmetResult) {
                result = mergeCompletionItems(result, emmetResult);
            }
        }

        return result;
    }

    public provideCompletionResolve(document: FlatDocument, item: CompletionItem) {
        let data = item.data;
        if (data && data.languageId) {
            let lang = this.getLanguage(data.languageId);
            if (lang && lang.doResolve && document) {
                return lang.doResolve(document, item);
            }
        }
        return item;
    }

    public provideDocumentSymbol(document: FlatDocument) {
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

    public provideDocumentLinks(document: FlatDocument) {
        let documentContext = this._workspace.getDocumentContext(document.uri);
        const links: DocumentLink[] = [];
        this.getAllLanguagesInDocument(document).forEach((m) => {
            if (m.findDocumentLinks) {
                pushAll(links, m.findDocumentLinks(document, documentContext));
            }
        });

        console.log('DocumentLinks', links);
        return links;
    }

    public provideSignatureHelp(document: FlatDocument, position: Position) {
        const lang = this.getLangAtPosition(document, position);
        if (!lang || !lang.doSignatureHelp) {
            return null;
        }
        const signature = lang.doSignatureHelp(document, position);

        console.log('signature', signature);
        return signature;
    }

    public provideReferences(document: FlatDocument, position: Position) {
        const lang = this.getLangAtPosition(document, position);
        if (!lang || !lang.findReferences) {
            return [];
        }

        const references = lang.findReferences(document, position);

        console.log('references', references);

        return references;
    }

    public provideDefinition(document: FlatDocument, position: Position) {
        const lang = this.getLangAtPosition(document, position);
        if (!lang || !lang.findDefinition) {
            return [];
        }
        const definitions = lang.findDefinition(document, position);

        console.log('definitions', definitions);
        return definitions;
    }

    public provideDocumentHighlight(document: FlatDocument, position: Position) {
        const lang = this.getLangAtPosition(document, position);
        if (!lang || !lang.findDocumentHighlight) {
            return [];
        }
        console.log('provideDocumentHighlight');
        return lang.findDocumentHighlight(document, position);
    }

    public provideHover(document: FlatDocument, position: Position) {
        const lang = this.getLangAtPosition(document, position);
        if (!lang || !lang.doHover) {
            return null;
        }

        const hover = lang.doHover(document, position);

        console.log('hover', hover);
        return hover;
    }

    public getLangAtPosition(document: FlatDocument, position: Position) {
        const docLang = this._openDocuments.get(document).docLangAtOffset(document.offsetAt(position));
        console.log('docLang', docLang);
        return this.getLanguage(docLang);
    }

    public getAllLanguagesInDocument(document: FlatDocument): Language[] {
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

    public documentChanged(document: FlatDocument) {
        this._openDocuments.set(document);
    }

    public documentClosed(document: FlatDocument) {
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

    public getRegions(doc: FlatDocument) {
        return new Regions(doc.uri).parse(parseFlatDoc(this._parser, doc));
    }
}

function mergeCompletionItems(list1: CompletionList, list2: CompletionList) {
    const items = list1.items;
    pushAll(items, list2.items);
    list1.items = items;
    return list1;
}

export function parseFlatDoc(parser: BladeParser, flatDoc: FlatDocument): Tree {
    if (DocLang.php !== flatDoc.languageId && DocLang.blade !== flatDoc.languageId) {
        return newAstTree();
    }

    try {
        return parser.parse(flatDoc.getText(), flatDoc.languageId);
    } catch (error) {
        return newAstTree();
    }
}

