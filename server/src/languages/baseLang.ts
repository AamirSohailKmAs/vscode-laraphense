'use strict';

import {
    CompletionItem,
    CompletionList,
    Definition,
    Diagnostic,
    DocumentHighlight,
    DocumentLink,
    Hover,
    Location,
    Position,
    SignatureHelp,
    SymbolInformation,
} from 'vscode-languageserver';
import { DocLang, ASTDocument } from '../support/document';
import { LanguageSettings as CssSetting } from 'vscode-css-languageservice';
import {
    CompletionConfiguration,
    DocumentContext,
    HTMLFormatConfiguration,
    HoverSettings,
} from 'vscode-html-languageservice';
import { URI, Utils } from 'vscode-uri';
import { folderContainsUri } from '../helpers/uri';

export class DocContext implements DocumentContext {
    private folderUri: string | undefined;
    constructor(folders: string[], uri?: string) {
        for (let i = 0; i < folders.length; i++) {
            const folder = folders[i];
            if (uri) {
                if (folderContainsUri(folder, uri)) {
                    this.folderUri = folder;
                }
                this.folderUri = uri + '/';
            }
        }
    }

    resolveReference(ref: string, base: string): string | undefined {
        if (ref.match(/^\w[\w\d+.-]*:/)) {
            // starts with a schema
            return ref;
        }
        if (ref[0] === '/') {
            // resolve absolute path against the current workspace folder
            if (this.folderUri) {
                return this.folderUri + ref.substr(1);
            }
        }
        const baseUri = URI.parse(base);
        const baseUriDir = baseUri.path.endsWith('/') ? baseUri : Utils.dirname(baseUri);
        return Utils.resolvePath(baseUriDir, ref).toString(true);
    }
}

export type Language = {
    id: DocLang;
    emmetSyntax?: 'html' | 'css';
    dispose: () => void;
    onDocumentRemoved: (uri: string) => void;
    doComplete?: (
        document: ASTDocument,
        position: Position,
        context: DocContext
    ) => CompletionList | Promise<CompletionList>;
    doHover?: (document: ASTDocument, position: Position) => Hover | null;
    doResolve?: (document: ASTDocument, item: CompletionItem) => CompletionItem;
    doSignatureHelp?: (document: ASTDocument, position: Position) => SignatureHelp | null;
    doValidation?: (document: ASTDocument) => Diagnostic[] | Promise<Diagnostic[]>;
    findReferences?: (document: ASTDocument, position: Position) => Location[];
    findDefinition?: (document: ASTDocument, position: Position) => Definition | null;
    findDocumentHighlight?: (document: ASTDocument, position: Position) => DocumentHighlight[];
    findDocumentLinks?: (document: ASTDocument, documentContext: DocContext) => DocumentLink[];
    findDocumentSymbols?: (document: ASTDocument) => SymbolInformation[];
};

type HtmlSetting = {
    hover?: HoverSettings;
    format?: HTMLFormatConfiguration;
    suggest?: unknown;
    autoClosingTags?: boolean;
    completion?: CompletionConfiguration;
};

export type laraphenseRc = {
    workspaceName: string;
    phpVersion: number;
    maxFileSize: number;
    cachePath: string;
};

export type laraphenseSetting = {
    phpVersion: number;
    maxFileSize: number;
};

export type Settings = {
    html?: HtmlSetting;
    css?: CssSetting;
    javascript?: { format?: unknown };
    laraphense?: laraphenseRc; // fixme: it must be laraphenseSetting as cachePath is self generated
    'js/ts'?: {
        implicitProjectConfig?: { experimentalDecorators?: boolean; strictNullChecks: boolean };
    };
    [key: string]: any;
};

