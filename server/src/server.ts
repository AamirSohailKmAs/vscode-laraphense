/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
    ConfigurationItem,
    DidChangeConfigurationNotification,
    DidChangeWatchedFilesParams,
    FileChangeType,
    InitializeParams,
    LSPErrorCodes,
    NotificationType,
    ResponseError,
    TextDocuments,
    TextDocumentSyncKind,
} from 'vscode-languageserver';
import { createConnection } from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Laraphense } from './laraphense';
import { Workspace } from './support/workspace';
import { FolderKind, FolderUri } from './support/workspaceFolder';
import { CONFIG_SECTION, DEFAULT_LARAPHENSE_CONFIG, DEFAULT_STUBS, EMPTY_COMPLETION_LIST } from './support/defaults';
import { join } from 'path';
import { existsSync } from 'fs';
import { getNestedValue, runSafe } from './helpers/general';
import { homedir } from 'os';
import { FileCache } from './support/cache';
import { FlatDocument } from './support/document';
import { laraphenseRc } from './languages/baseLang';
import { pathToUri } from './helpers/uri';

const connection = createConnection();

let settings: any;
let workspace: Workspace;
let laraphense: Laraphense;
let startTime: [number, number];
let InitializeParams: InitializeParams;
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
const emmetTriggerCharacters = ['!', '.', '}', ':', '*', '$', ']', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const INDEXING_STARTED_NOTIFICATION = new NotificationType('indexingStarted');
const INDEXING_ENDED_NOTIFICATION = new NotificationType('indexingEnded');

function hasCapability<T>(key: string, defaultValue: T) {
    return getNestedValue(InitializeParams.capabilities, key, defaultValue);
}

async function setSettings() {
    if (!hasCapability('workspace.configuration', false)) {
        return;
    }

    const items: ConfigurationItem[] = ['editor', 'html', 'css', 'javascript', CONFIG_SECTION, 'js/ts'].map((key) => {
        return { section: key };
    });

    for (const [uri, folder] of workspace.folders) {
        if (folder.kind !== FolderKind.Stub) {
            items.push({
                section: CONFIG_SECTION,
                scopeUri: uri,
            });
        }
    }

    settings = await connection.workspace.getConfiguration(items);
    laraphense.settings = Object.assign({}, settings[0]);
}

connection.onInitialize(async (params: InitializeParams) => {
    InitializeParams = params;
    startTime = process.hrtime();
    console.log(`laraphense started at ${new Date().toLocaleTimeString()}`);

    const cachePath: string = params.initializationOptions?.storagePath ?? join(homedir(), 'porifa_laraphense');
    const workspaceName: string = params.initializationOptions?.workspaceName ?? 'Porifa';
    const clearCache: boolean = params.initializationOptions?.clearCache ?? true;

    const config: laraphenseRc = { ...DEFAULT_LARAPHENSE_CONFIG, cachePath, workspaceName };

    let storageCache = await FileCache.create(cachePath);

    if (clearCache && storageCache) {
        storageCache = await storageCache.clear();
    }

    workspace = new Workspace(config, storageCache, pathToUri(join(__dirname, '../stubs')) as FolderUri);

    if (params.workspaceFolders) {
        params.workspaceFolders.forEach((folder) => {
            workspace.addFolder(folder.name, folder.uri);
        });
    } else if (params.rootUri) {
        workspace.addFolder(workspaceName, params.rootUri);
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

connection.onInitialized(async () => {
    workspace.folderIndexingStarted.addListener((e) => {
        console.log(`Indexing (${e.name}) started with ${e.withFiles} files`);
        startTime = process.hrtime();
        connection.sendNotification(INDEXING_STARTED_NOTIFICATION.method);
    });

    workspace.folderIndexingEnded.addListener((e) => {
        console.info(`Indexing (${e.name}) ended with ${e.withFiles} files in ${process.hrtime(startTime)[0]}s.`);
        connection.sendNotification(INDEXING_ENDED_NOTIFICATION.method);
    });

    if (hasCapability('workspace.workspaceFolders', false)) {
        connection.workspace.onDidChangeWorkspaceFolders(async (e) => {
            for (let i = 0; i < e.added.length; ++i) {
                workspace.addFolder(e.added[i].name, e.added[i].uri);
            }
            for (let j = 0; j < e.removed.length; ++j) {
                workspace.removeFolder(e.removed[j].uri);
            }
        });
    }
    setSettings();

    if (hasCapability('workspace.didChangeConfiguration.dynamicRegistration', false)) {
        await connection.client.register(DidChangeConfigurationNotification.type, {
            section: CONFIG_SECTION,
        });
    }
});

connection.onDidChangeConfiguration(async () => {
    setSettings();
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

// Handle watched files changes
connection.onDidChangeWatchedFiles((params: DidChangeWatchedFilesParams) => {
    console.log(params);

    for (const change of params.changes) {
        switch (change.type) {
            case FileChangeType.Created:
                // Handle file creation
                console.log(`watched File created: ${change.uri}`);
                break;
            case FileChangeType.Changed:
                // Handle file change
                console.log(`watched File changed: ${change.uri}`);
                break;
            case FileChangeType.Deleted:
                // Handle file deletion
                console.log(`watched File deleted: ${change.uri}`);
                break;
        }
    }
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

