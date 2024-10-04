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
    TextDocumentSyncKind,
} from 'vscode-languageserver';
import { createConnection } from 'vscode-languageserver/node';

import { Laraphense } from './laraphense';
import { Workspace } from './support/workspace';
import { FolderUri } from './support/workspaceFolder';
import { CONFIG_SECTION, DEFAULT_LARAPHENSE_CONFIG } from './support/defaults';
import { join } from 'path';
import { getNestedValue, runSafe } from './helpers/general';
import { homedir } from 'os';
import { FileCache } from './support/cache';
import { laraphenseRc } from './languages/baseLang';
import { pathToUri } from './helpers/uri';

const connection = createConnection();

let settings: any;
let workspace: Workspace;
let laraphense: Laraphense | undefined;
let startTime: [number, number];
let InitializeParams: InitializeParams;
const emmetTriggerCharacters = ['!', '.', '}', ':', '*', '$', ']', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const INDEXING_STARTED_NOTIFICATION = new NotificationType('indexingStarted');
const INDEXING_ENDED_NOTIFICATION = new NotificationType('indexingEnded');

function hasCapability<T>(key: string, defaultValue: T) {
    return getNestedValue(InitializeParams.capabilities, key, defaultValue);
}

async function setSettings() {
    if (!hasCapability('workspace.configuration', false) || !laraphense) {
        return;
    }

    const items: ConfigurationItem[] = ['editor', 'html', 'css', 'javascript', CONFIG_SECTION, 'js/ts'].map((key) => {
        return { section: key };
    });

    for (const [uri, folder] of workspace.folders) {
        if (!folder.isStubs) {
            items.push({
                section: CONFIG_SECTION,
                scopeUri: uri,
            });
        }
    }

    settings = await connection.workspace.getConfiguration(items);
    laraphense.setSettings(items, settings);
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

    if (!storageCache) {
        return { capabilities: {} };
    }

    if (clearCache) {
        await storageCache.clear();
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

            // documentHighlightProvider: true,
            documentSymbolProvider: true,
            // workspaceSymbolProvider: true,

            definitionProvider: true,
            referencesProvider: true,

            // implementationProvider: true,
            // declarationProvider: true,

            // typeDefinitionProvider: true,

            // renameProvider: {prepareProvider: true },

            // signatureHelpProvider: { triggerCharacters: ['(', ',', ':'] },

            workspace: { workspaceFolders: { supported: true, changeNotifications: true } },
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
    if (!laraphense) {
        return;
    }
    laraphense.shutdown();
});

connection.onDidChangeTextDocument((param) => {
    if (!laraphense) {
        return;
    }

    laraphense.documentChanged(param.textDocument.uri, param.textDocument.version, param.contentChanges);
});

connection.onDidOpenTextDocument((param) => {
    if (!laraphense) {
        return;
    }

    laraphense.documentOpened(param.textDocument);
});

connection.onDidCloseTextDocument((param) => {
    if (!laraphense) {
        return;
    }

    connection.sendDiagnostics({ uri: param.textDocument.uri, diagnostics: [] });
    laraphense.documentClosed(param.textDocument.uri);
});

// Handle watched files changes
connection.onDidChangeWatchedFiles((params: DidChangeWatchedFilesParams) => {
    for (const change of params.changes) {
        switch (change.type) {
            case FileChangeType.Created:
                workspace.addFile(change.uri);
                break;
            case FileChangeType.Changed:
                // Handle file change
                console.log(`watched File changed: ${change.uri}`);
                break;
            case FileChangeType.Deleted:
                workspace.removeFile(change.uri);
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
            if (!laraphense) {
                return;
            }
            return laraphense.provideCompletion(textDocumentPosition);
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
            if (!data || !data.uri || !laraphense) {
                return item;
            }

            return laraphense.provideCompletionResolve(item);
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
            if (!laraphense) {
                return null;
            }
            return laraphense.provideHover(textDocumentPosition.textDocument.uri, textDocumentPosition.position);
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
            if (!laraphense) {
                return [];
            }
            return laraphense.provideDocumentHighlight(
                documentHighlightParams.textDocument.uri,
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
            if (!laraphense) {
                return [];
            }
            return laraphense.provideDefinition(definitionParams.textDocument.uri, definitionParams.position);
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
            if (!laraphense) {
                return [];
            }
            return laraphense.provideReferences(referenceParams.textDocument.uri, referenceParams.position);
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
            if (!laraphense) {
                return null;
            }
            return laraphense.provideSignatureHelp(signatureHelpParams.textDocument.uri, signatureHelpParams.position);
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
            if (!laraphense) {
                return [];
            }
            return laraphense.provideDocumentLinks(documentLinkParam.textDocument.uri);
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
            if (!laraphense) {
                return [];
            }
            return laraphense.provideDocumentSymbol(documentSymbolParams.textDocument.uri);
        },
        [],
        `Error while computing document symbols for ${documentSymbolParams.textDocument.uri}`
    );
});

connection.listen();

