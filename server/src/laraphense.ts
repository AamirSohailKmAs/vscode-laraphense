'use strict';

import { Workspace } from './support/workspace';
import { doComplete } from '@vscode/emmet-helper';
import {
    CompletionItem,
    CompletionList,
    CompletionParams,
    ConfigurationItem,
    DocumentLink,
    DocumentUri,
    Position,
    SymbolInformation,
    TextDocumentContentChangeEvent,
    TextDocumentItem,
} from 'vscode-languageserver';
import { pushAll } from './helpers/general';
import { ASTDocument, DocLang } from './support/document';

import { getCSSLanguageService } from 'vscode-css-languageservice';
import { getLanguageService as getHTMLLanguageService } from 'vscode-html-languageservice';
import { Html } from './languages/htmlLang';
import { Css } from './languages/cssLang';
import { DocContext, Language, Settings } from './languages/baseLang';
import { Js } from './languages/jsLang';
import { Blade } from './languages/bladeLang';
import { Php } from './languages/phpLang';
import { FolderUri } from './support/workspaceFolder';
import { Compiler } from './support/Compiler';

export class Laraphense {
    private _compiler: Compiler;
    private _settings: Settings = {};

    private _languages: Map<DocLang, Language> = new Map();

    constructor(private _workspace: Workspace) {
        this._compiler = new Compiler(this._workspace);

        const htmlLang = new Html(getHTMLLanguageService(), this._settings);
        const phpLang = new Php(_workspace);
        const bladeLang = new Blade(htmlLang);

        this._languages.set(DocLang.html, htmlLang);
        this._languages.set(DocLang.php, phpLang);
        this._languages.set(DocLang.blade, bladeLang);
        this._languages.set(DocLang.js, new Js(this._compiler.regions, DocLang.js, this._settings));
        this._languages.set(DocLang.css, new Css(getCSSLanguageService(), this._compiler.regions, this._settings));
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

    public async provideCompletion({ position, textDocument, context }: CompletionParams) {
        let list: CompletionList = { items: [], isIncomplete: false };

        const result = this.getLangAtPosition(textDocument.uri, position);
        if (!result) {
            return list;
        }

        const { document, lang } = result;

        list = this.addEmmetCompletions(list, document, lang, position);
        list = this.addWorkspaceCompletions(list, textDocument.uri, lang.id, document, position);
        list = await this.addLanguageCompletions(list, lang, document, position, textDocument.uri);

        return list;
    }

    public provideCompletionResolve(item: CompletionItem) {
        let data = item.data;
        if (data && data.languageId && item.data.uri) {
            const doc = this._compiler.getDoc(item.data.uri);
            let lang = this.getLanguage(data.languageId);
            if (lang && lang.doResolve && doc) {
                return lang.doResolve(doc, item);
            }
        }
        return item;
    }

    public provideDocumentSymbol(uri: string) {
        let symbols: SymbolInformation[] = [];
        const document = this._compiler.getDoc(uri);
        if (!document) {
            return symbols;
        }

        this.getAllLanguagesInDocument(uri).forEach((m) => {
            if (m.findDocumentSymbols) {
                const newSymbols: SymbolInformation[] = [];
                let result = m.findDocumentSymbols(document);
                for (let i = 0; i < result.length; i++) {
                    const symbol = result[i];
                    if (symbol.name === '?') {
                        continue;
                    }
                    newSymbols.push(symbol);
                }

                pushAll(symbols, newSymbols);
            }
        });

        return symbols;
    }

    public provideDocumentLinks(uri: string) {
        const links: DocumentLink[] = [];

        const document = this._compiler.getDoc(uri);
        if (!document) {
            return links;
        }

        let documentContext = this.getDocumentContext(uri);
        this.getAllLanguagesInDocument(uri).forEach((m) => {
            if (m.findDocumentLinks) {
                pushAll(links, m.findDocumentLinks(document, documentContext));
            }
        });

        console.log('DocumentLinks', links);
        return links;
    }

    public provideSignatureHelp(uri: string, position: Position) {
        const kmas = this.getLangAtPosition(uri, position);
        if (!kmas) {
            return null;
        }

        const { document, lang } = kmas;

        if (!lang.doSignatureHelp) {
            return null;
        }
        const signature = lang.doSignatureHelp(document, position);

        console.log('signature', signature);
        return signature;
    }

    public provideReferences(uri: string, position: Position) {
        const kmas = this.getLangAtPosition(uri, position);
        if (!kmas) {
            return null;
        }
        const { document, lang } = kmas;
        if (!lang || !lang.findReferences) {
            return [];
        }

        const references = lang.findReferences(document, position);

        console.log('references', references);

        return references;
    }

    public provideDefinition(uri: string, position: Position) {
        const kmas = this.getLangAtPosition(uri, position);
        if (!kmas) {
            return null;
        }
        const { document, lang } = kmas;
        if (!lang || !lang.findDefinition) {
            return [];
        }
        const definitions = lang.findDefinition(document, position);

        console.log('definitions', definitions);
        return definitions;
    }

    public provideDocumentHighlight(uri: string, position: Position) {
        const kmas = this.getLangAtPosition(uri, position);
        if (!kmas) {
            return null;
        }
        const { document, lang } = kmas;
        if (!lang || !lang.findDocumentHighlight) {
            return [];
        }
        console.log('provideDocumentHighlight');
        return lang.findDocumentHighlight(document, position);
    }

    public provideHover(uri: string, position: Position) {
        const kmas = this.getLangAtPosition(uri, position);
        if (!kmas) {
            return null;
        }
        const { document, lang } = kmas;
        if (!lang || !lang.doHover) {
            return null;
        }

        const hover = lang.doHover(document, position);

        console.log('hover', hover);
        return hover;
    }

    public getLangAtPosition(uri: string, position: Position) {
        const document = this._compiler.getDoc(uri);
        if (!document) {
            return undefined;
        }

        const docLang = this._compiler.regions.docLangAtOffset(uri, document.offsetAt(position));
        console.log('docLang', docLang);
        const lang = this.getLanguage(docLang);
        if (!lang) {
            return undefined;
        }
        return { document, lang };
    }

    public getAllLanguagesInDocument(uri: string): Language[] {
        const result = [];
        for (const languageId of this._compiler.regions.docLangsInDocument(uri, this._languages.size)) {
            const language = this._languages.get(languageId);
            if (language) {
                result.push(language);
            }
        }
        return result;
    }

    public getLanguage(languageId: DocLang): Language | undefined {
        return this._languages.get(languageId);
    }

    public documentOpened(doc: TextDocumentItem) {
        this._compiler.OpenDoc(doc.uri, doc.version, doc.text);
    }

    public documentChanged(uri: string, version: number, changes: TextDocumentContentChangeEvent[]) {
        this._compiler.updateDoc(uri, version, changes);
    }

    public documentClosed(uri: string) {
        this._compiler.closeDoc(uri);

        this._languages.forEach((language) => {
            language.onDocumentRemoved(uri);
        });
    }

    public shutdown() {
        this._compiler.shutdown();

        this._languages.forEach((lang) => {
            lang.dispose();
        });
        this._languages.clear();
    }

    private getDocumentContext(documentUri: string) {
        return new DocContext(Array.from(this._workspace.folders.keys()), documentUri);
    }

    private addWorkspaceCompletions(
        list: CompletionList,
        uri: DocumentUri,
        langId: DocLang,
        document: ASTDocument,
        position: Position
    ): CompletionList {
        const space = this._workspace.getProjectSpace(uri);
        if (space) {
            for (const library of space.folder.libraries) {
                if (library.doComplete) {
                    const libraryCompletions = library.doComplete(langId, document, position);
                    list = mergeCompletionItems(list, libraryCompletions);
                }
            }
        }
        return list;
    }
    private addEmmetCompletions(
        list: CompletionList,
        document: ASTDocument,
        lang: Language,
        position: Position
    ): CompletionList {
        if (lang.emmetSyntax) {
            const emmetResult = doComplete(document.doc, position, lang.emmetSyntax, {});
            if (emmetResult) {
                list = mergeCompletionItems(list, emmetResult);
            }
        }
        return list;
    }

    private async addLanguageCompletions(
        list: CompletionList,
        lang: Language,
        document: ASTDocument,
        position: Position,
        uri: DocumentUri
    ): Promise<CompletionList> {
        if (lang.doComplete) {
            const items = await lang.doComplete(document, position, this.getDocumentContext(uri));
            list = mergeCompletionItems(list, items);
        }
        return list;
    }
}

function mergeCompletionItems(list1: CompletionList, list2: CompletionList): CompletionList {
    if (!list1 || !list2) return list1 || list2;

    const combinedItems = [...list1.items, ...list2.items];

    // De-duplicate based on `label`
    const uniqueItems = combinedItems.reduce((acc, item) => {
        if (!acc.some((existingItem) => existingItem.label === item.label)) {
            acc.push(item);
        }
        return acc;
    }, [] as CompletionItem[]);

    list1.items = uniqueItems;
    list1.isIncomplete = list1.isIncomplete || list2.isIncomplete;

    return list1;
}

