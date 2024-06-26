/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
    InitializeParams,
    LSPErrorCodes,
    ResponseError,
    TextDocuments,
    TextDocumentSyncKind,
} from 'vscode-languageserver';
import { createConnection } from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Laraphense } from './laraphense/laraphense';
import { Workspace } from './laraphense/workspace';
import { FolderKind } from './laraphense/workspaceFolder';
import { URI } from 'vscode-uri';
import { DEFAULT_LARAPHENSE_CONFIG, DEFAULT_STUBS, EMPTY_COMPLETION_LIST } from './support/defaults';
import { join } from 'path';
import { existsSync } from 'fs';
import { runSafe } from './helpers/general';
import { homedir } from 'os';
import { FileCache } from './support/cache';
import { FlatDocument } from './laraphense/document';

const connection = createConnection();

let workspace: Workspace;
let laraphense: Laraphense;
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
const emmetTriggerCharacters = ['!', '.', '}', ':', '*', '$', ']', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

connection.onInitialize(async (params: InitializeParams) => {
    console.log(`laraphense started at ${new Date().toLocaleTimeString()}`);
    workspace = new Workspace(DEFAULT_LARAPHENSE_CONFIG);

    let stubsPath = join(__dirname, '../stubs');

    if (existsSync(stubsPath)) {
        workspace.addFolder(URI.parse(stubsPath).toString(), FolderKind.Stub, DEFAULT_STUBS);
    }

    if (params.workspaceFolders) {
        params.workspaceFolders.forEach((folder) => {
            workspace.addFolder(URI.parse(folder.uri).toString());
        });
    } else if (params.rootUri) {
        workspace.addFolder(URI.parse(params.rootUri).toString());
    }

    const storagePath: string = params.initializationOptions?.storagePath ?? join(homedir(), 'porifa_laraphense');
    const workspaceName: string = params.initializationOptions?.workspaceName ?? 'workspace';
    const clearCache: boolean = params.initializationOptions?.clearCache ?? true;

    let storageCache: FileCache | undefined;
    if (workspace.folders.size > 1) {
        storageCache = await FileCache.create(join(storagePath, workspaceName));

        if (clearCache && storageCache) {
            storageCache = await storageCache.clear();
        }
    }

    laraphense = new Laraphense(workspace);

    return {
        capabilities: {
            textDocumentSync: {
                openClose: true,
                change: TextDocumentSyncKind.Incremental,
            },
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: [...emmetTriggerCharacters, '@', '.', ':', '<', '"', '=', '/'],
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

// connection.onInitialized(() => {
//     workspace.indexWorkspace();
// });

connection.onDidChangeConfiguration((change) => {
    // fixme:
    laraphense.settings = change.settings;
});

connection.onShutdown(() => {
    laraphense.shutdown();
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
    laraphense.documentChanged(FlatDocument.fromTextDocument(change.document));
});

documents.onDidOpen((_param) => {
    laraphense.documentOpened(documents.all());
});

documents.onDidClose((param) => {
    connection.sendDiagnostics({ uri: param.document.uri, diagnostics: [] });
    laraphense.documentClosed(FlatDocument.fromTextDocument(param.document));
});

connection.onCompletion(async (textDocumentPosition, token) => {
    if (token.isCancellationRequested) {
        return new ResponseError(LSPErrorCodes.RequestCancelled, 'Request cancelled.');
    }
    return runSafe(
        () => {
            const document = documents.get(textDocumentPosition.textDocument.uri);
            if (!document) {
                return EMPTY_COMPLETION_LIST;
            }
            return laraphense.provideCompletion(
                FlatDocument.fromTextDocument(document),
                textDocumentPosition.position,
                textDocumentPosition.context
            );
        },
        null,
        `Error while computing completions for ${textDocumentPosition.textDocument.uri}`
    );
});

connection.onCompletionResolve((item, token) => {
    if (token.isCancellationRequested) {
        return new ResponseError(LSPErrorCodes.RequestCancelled, 'Request cancelled.');
    }
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
            return laraphense.provideCompletionResolve(FlatDocument.fromTextDocument(document), item);
        },
        item,
        `Error while resolving completion proposal`
    );
});

connection.onHover((textDocumentPosition, token) => {
    if (token.isCancellationRequested) {
        return new ResponseError(LSPErrorCodes.RequestCancelled, 'Request cancelled.');
    }
    return runSafe(
        () => {
            let document = documents.get(textDocumentPosition.textDocument.uri);
            if (!document) {
                return null;
            }
            return laraphense.provideHover(FlatDocument.fromTextDocument(document), textDocumentPosition.position);
        },
        null,
        `Error while computing hover for ${textDocumentPosition.textDocument.uri}`
    );
});

connection.onDocumentHighlight((documentHighlightParams, token) => {
    if (token.isCancellationRequested) {
        return new ResponseError(LSPErrorCodes.RequestCancelled, 'Request cancelled.');
    }
    return runSafe(
        () => {
            let document = documents.get(documentHighlightParams.textDocument.uri);
            if (!document) {
                return [];
            }
            return laraphense.provideDocumentHighlight(
                FlatDocument.fromTextDocument(document),
                documentHighlightParams.position
            );
        },
        [],
        `Error while computing document highlights for ${documentHighlightParams.textDocument.uri}`
    );
});

connection.onDefinition((definitionParams, token) => {
    if (token.isCancellationRequested) {
        return new ResponseError(LSPErrorCodes.RequestCancelled, 'Request cancelled.');
    }
    return runSafe(
        () => {
            let document = documents.get(definitionParams.textDocument.uri);
            if (!document) {
                return [];
            }
            return laraphense.provideDefinition(FlatDocument.fromTextDocument(document), definitionParams.position);
        },
        [],
        `Error while computing definitions for ${definitionParams.textDocument.uri}`
    );
});

connection.onReferences((referenceParams, token) => {
    if (token.isCancellationRequested) {
        return new ResponseError(LSPErrorCodes.RequestCancelled, 'Request cancelled.');
    }
    return runSafe(
        () => {
            let document = documents.get(referenceParams.textDocument.uri);
            if (!document) {
                return [];
            }
            return laraphense.provideReferences(FlatDocument.fromTextDocument(document), referenceParams.position);
        },
        [],
        `Error while computing references for ${referenceParams.textDocument.uri}`
    );
});

connection.onSignatureHelp((signatureHelpParams, token) => {
    if (token.isCancellationRequested) {
        return new ResponseError(LSPErrorCodes.RequestCancelled, 'Request cancelled.');
    }
    return runSafe(
        () => {
            let document = documents.get(signatureHelpParams.textDocument.uri);
            if (!document) {
                return null;
            }
            return laraphense.provideSignatureHelp(
                FlatDocument.fromTextDocument(document),
                signatureHelpParams.position
            );
        },
        null,
        `Error while computing signature help for ${signatureHelpParams.textDocument.uri}`
    );
});

connection.onDocumentLinks((documentLinkParam, token) => {
    if (token.isCancellationRequested) {
        return new ResponseError(LSPErrorCodes.RequestCancelled, 'Request cancelled.');
    }
    return runSafe(
        () => {
            let document = documents.get(documentLinkParam.textDocument.uri);
            if (!document) {
                return [];
            }
            return laraphense.provideDocumentLinks(FlatDocument.fromTextDocument(document));
        },
        [],
        `Error while document links for ${documentLinkParam.textDocument.uri}`
    );
});

connection.onDocumentSymbol((documentSymbolParams, token) => {
    if (token.isCancellationRequested) {
        return new ResponseError(LSPErrorCodes.RequestCancelled, 'Request cancelled.');
    }
    return runSafe(
        () => {
            let document = documents.get(documentSymbolParams.textDocument.uri);
            if (!document) {
                return [];
            }
            return laraphense.provideDocumentSymbol(FlatDocument.fromTextDocument(document));
        },
        [],
        `Error while computing document symbols for ${documentSymbolParams.textDocument.uri}`
    );
});

documents.listen(connection);

connection.listen();

