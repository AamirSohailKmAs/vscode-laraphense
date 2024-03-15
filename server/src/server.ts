/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { InitializeParams, TextDocuments, TextDocumentSyncKind } from 'vscode-languageserver';
import { createConnection } from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Laraphense } from './laraphense/laraphense';
import { Workspace } from './laraphense/indexing/workspace';
import { FolderKind, WorkspaceFolder } from './laraphense/indexing/workspaceFolder';
import { URI } from 'vscode-uri';
import { DEFAULT_STUBS, EMPTY_COMPLETION_LIST } from './support/defaults';
import { join } from 'path';
import { existsSync } from 'fs';
import { runSafe } from './helpers/general';

const connection = createConnection();

let workspace: Workspace;
let laraphense: Laraphense;
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
const emmetTriggerCharacters = ['!', '.', '}', ':', '*', '$', ']', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

connection.onInitialize(async (params: InitializeParams) => {
    console.log(`laraphense started at ${new Date().toLocaleTimeString()}`);
    workspace = new Workspace();

    let stubsPath = join(__dirname, '../stubs');

    if (existsSync(stubsPath)) {
        workspace.addFolder(new WorkspaceFolder(URI.parse(stubsPath).toString(), FolderKind.Stub, DEFAULT_STUBS));
    }

    if (params.workspaceFolders) {
        params.workspaceFolders.forEach((folder) => {
            workspace.addFolder(new WorkspaceFolder(URI.parse(folder.uri).toString()));
        });
    } else if (params.rootUri) {
        workspace.addFolder(new WorkspaceFolder(URI.parse(params.rootUri).toString()));
    }

    laraphense = new Laraphense(workspace);

    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: [...emmetTriggerCharacters, '.', ':', '<', '"', '=', '/'],
            },
            hoverProvider: true,
            documentHighlightProvider: true,
            documentRangeFormattingProvider: false,
            documentSymbolProvider: true,
            definitionProvider: true,
            signatureHelpProvider: { triggerCharacters: ['('] },
            referencesProvider: true,
        },
    };
});

connection.onInitialized(() => {
    workspace.indexWorkspace();
});

connection.onDidChangeConfiguration((change) => {
    workspace.settings = change.settings;
});

connection.onShutdown(() => {
    workspace.shutdown();
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
    workspace.documentChanged(change.document);
});

documents.onDidOpen((_param) => {
    workspace.documentOpened(documents.all());
});

documents.onDidClose((param) => {
    connection.sendDiagnostics({ uri: param.document.uri, diagnostics: [] });
    workspace.documentClosed(param.document);
});

connection.onCompletion(async (textDocumentPosition) => {
    return runSafe(
        () => {
            const document = documents.get(textDocumentPosition.textDocument.uri);
            if (!document) {
                return EMPTY_COMPLETION_LIST;
            }
            return laraphense.provideCompletion(document, textDocumentPosition.position, textDocumentPosition.context);
        },
        null,
        `Error while computing completions for ${textDocumentPosition.textDocument.uri}`
    );
});

connection.onCompletionResolve((item) => {
    return runSafe(
        () => {
            let data = item.data;
            if (!data || !data.uri) {
                return item;
            }

            let document = documents.get(item.data.uri);
            if (!document) {
                return item;
            }
            return laraphense.provideCompletionResolve(document, item);
        },
        item,
        `Error while resolving completion proposal`
    );
});

connection.onHover((textDocumentPosition) => {
    return runSafe(
        () => {
            let document = documents.get(textDocumentPosition.textDocument.uri);
            if (!document) {
                return null;
            }
            return laraphense.provideHover(document, textDocumentPosition.position);
        },
        null,
        `Error while computing hover for ${textDocumentPosition.textDocument.uri}`
    );
});

connection.onDocumentHighlight((documentHighlightParams) => {
    return runSafe(
        () => {
            let document = documents.get(documentHighlightParams.textDocument.uri);
            if (!document) {
                return [];
            }
            return laraphense.provideDocumentHighlight(document, documentHighlightParams.position);
        },
        [],
        `Error while computing document highlights for ${documentHighlightParams.textDocument.uri}`
    );
});

connection.onDefinition((definitionParams) => {
    return runSafe(
        () => {
            let document = documents.get(definitionParams.textDocument.uri);
            if (!document) {
                return [];
            }
            return laraphense.provideDefinition(document, definitionParams.position);
        },
        [],
        `Error while computing definitions for ${definitionParams.textDocument.uri}`
    );
});

connection.onReferences((referenceParams) => {
    return runSafe(
        () => {
            let document = documents.get(referenceParams.textDocument.uri);
            if (!document) {
                return [];
            }
            return laraphense.provideReferences(document, referenceParams.position);
        },
        [],
        `Error while computing references for ${referenceParams.textDocument.uri}`
    );
});

connection.onSignatureHelp((signatureHelpParams) => {
    return runSafe(
        () => {
            let document = documents.get(signatureHelpParams.textDocument.uri);
            if (!document) {
                return null;
            }
            return laraphense.provideSignatureHelp(document, signatureHelpParams.position);
        },
        null,
        `Error while computing signature help for ${signatureHelpParams.textDocument.uri}`
    );
});

connection.onDocumentLinks((documentLinkParam) => {
    return runSafe(
        () => {
            let document = documents.get(documentLinkParam.textDocument.uri);
            if (!document) {
                return [];
            }
            return laraphense.provideDocumentLinks(document);
        },
        [],
        `Error while document links for ${documentLinkParam.textDocument.uri}`
    );
});

connection.onDocumentSymbol((documentSymbolParams) => {
    return runSafe(
        () => {
            let document = documents.get(documentSymbolParams.textDocument.uri);
            if (!document) {
                return [];
            }
            return laraphense.provideDocumentSymbol(document);
        },
        [],
        `Error while computing document symbols for ${documentSymbolParams.textDocument.uri}`
    );
});

documents.listen(connection);

connection.listen();

