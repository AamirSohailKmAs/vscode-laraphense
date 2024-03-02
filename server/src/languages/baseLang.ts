'use strict';

import {
    CompletionItem,
    CompletionList,
    Definition,
    Diagnostic,
    DocumentHighlight,
    Hover,
    Location,
    Position,
    SignatureHelp,
    SymbolInformation,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocLang } from '../laraphense/document';
import { LanguageSettings as CssSetting } from 'vscode-css-languageservice';
import {
    CompletionConfiguration,
    DocumentContext,
    HTMLFormatConfiguration,
    HoverSettings,
} from 'vscode-html-languageservice';
import { URI, Utils } from 'vscode-uri';

export class LaraphenseDocumentContext implements DocumentContext {
    folderUri: string | undefined = undefined;
    constructor(uri?: string) {
        if (uri) {
            this.folderUri = uri + '/';
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
    doResolve?: (document: TextDocument, item: CompletionItem) => CompletionItem;
    doHover?: (document: TextDocument, position: Position) => Hover | null;
    findDocumentHighlight?: (document: TextDocument, position: Position) => DocumentHighlight[];
    findDefinition?: (document: TextDocument, position: Position) => Definition | null;
    findReferences?: (document: TextDocument, position: Position) => Location[];
    doSignatureHelp?: (document: TextDocument, position: Position) => SignatureHelp | null;
    findDocumentSymbols?: (document: TextDocument) => SymbolInformation[];
    doValidation?: (document: TextDocument) => Diagnostic[] | Promise<Diagnostic[]>;
    doComplete?: (
        document: TextDocument,
        position: Position,
        context: LaraphenseDocumentContext
    ) => CompletionList | Promise<CompletionList>;
    onDocumentRemoved: (document: TextDocument) => void;
    dispose: () => void;
};


type HtmlSetting = {
    hover?: HoverSettings;
    format?: HTMLFormatConfiguration;
    suggest?: unknown;
    autoClosingTags?: boolean;
    completion?: CompletionConfiguration;
};
export type Settings = {
    html?: HtmlSetting;
    css?: CssSetting;
    javascript?: { format?: unknown };
    'js/ts'?: {
        implicitProjectConfig?: { experimentalDecorators?: boolean; strictNullChecks: boolean };
    };
};

