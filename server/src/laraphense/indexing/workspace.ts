'use strict';

import { DocumentUri, Position, TextDocument } from 'vscode-languageserver-textdocument';
import { DEFAULT_MAX_FILE_SIZE, DEFAULT_PHP_VERSION } from '../../support/defaults';
import { Indexer } from './indexer';
import { WorkspaceFolder } from './workspaceFolder';
import { getCSSLanguageService } from 'vscode-css-languageservice';
import { getLanguageService as getHTMLLanguageService } from 'vscode-html-languageservice';
import { MemoryCache } from '../../support/cache';
import { Html } from '../../languages/htmlLang';
import { Css } from '../../languages/cssLang';
import { Language, DocContext, Settings, laraphenseRc } from '../../languages/baseLang';
import { DocLang, Regions } from '../document';
import { folderContainsUri } from '../../helpers/uri';
import { Js } from '../../languages/jsLang';
import { Pri } from '../../types/general';
import { Compiler } from '../compiler';
import { Blade } from '../../languages/bladeLang';

export class Workspace {
    private _indexer: Indexer;
    private _compiler: Compiler;
    private _config: laraphenseRc;
    private _folders: Map<DocumentUri, WorkspaceFolder> = new Map();
    private _settings: Settings = {};

    private _languages: Map<DocLang, Language> = new Map();
    private _openDocuments: MemoryCache<Regions>;

    constructor() {
        this._config = { maxFileSize: DEFAULT_MAX_FILE_SIZE, phpVersion: DEFAULT_PHP_VERSION };
        this._compiler = new Compiler(this.config);
        this._indexer = new Indexer(this._compiler, this.config);
        const htmlLang = new Html(getHTMLLanguageService(), this._settings);

        this._openDocuments = new MemoryCache((doc) => new Regions().parse(this._compiler.parseDoc(doc)));

        this._languages.set(DocLang.html, htmlLang);
        this._languages.set(DocLang.css, new Css(getCSSLanguageService(), this._openDocuments, this._settings));
        this._languages.set(DocLang.js, new Js(this._openDocuments, DocLang.js, this._settings));
        this._languages.set(DocLang.blade, new Blade(htmlLang));
    }

    public get config(): laraphenseRc {
        return this._config;
    }

    public set settings(settings: Settings) {
        this._settings = settings;
        if (settings.laraphense) {
            this._config = settings.laraphense;
        }
    }

    public get folders() {
        return this._folders;
    }

    public indexWorkspace() {
        this._folders.forEach(async (folder) => {
            await this._indexer.indexFolder(folder);
        });
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

    public addFolder(folder: WorkspaceFolder) {
        this._folders.set(folder.uri, folder);
    }

    public removeFolder(uri: string) {
        this._folders.delete(uri);
    }

    // findFolderContainingUri
    public uriToPri(uri: string) {
        for (const folder in this._folders.keys()) {
            if (folderContainsUri(folder, uri)) {
                return { folder: folder, sub: uri.replace(folder, ''), uri } satisfies Pri;
            }
        }
    }

    public getDocumentContext(documentUri: string) {
        return new DocContext(this.uriToPri(documentUri)?.folder);
    }

    public getLangAtPosition(document: TextDocument, position: Position): Language | undefined {
        const docLang = this._openDocuments.get(document).docLangAtOffset(document.offsetAt(position));

        return this._languages.get(docLang);
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
    public getAllLanguages(): Language[] {
        return Array.from(this._languages.values());
    }
    public getLanguage(languageId: DocLang): Language | undefined {
        return this._languages.get(languageId);
    }
}

