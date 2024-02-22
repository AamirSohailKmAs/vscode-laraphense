/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
    createConnection,
    InitializeParams,
    ProposedFeatures,
    TextDocuments,
    TextDocumentSyncKind,
} from 'vscode-languageserver';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Laraphense } from './laraphense';
import { Workspace } from './laraphense/indexing/workspace';
import { WorkspaceFolder } from './laraphense/indexing/workspaceFolder';
import { URI } from 'vscode-uri';
import { DEFAULT_EXCLUDE, EMPTY_COMPLETION_LIST } from './support/defaults';

const connection = createConnection(ProposedFeatures.all);
// console.log = connection.console.log.bind(connection.console);
// console.error = connection.console.error.bind(connection.console);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
let laraphense: Laraphense;
const emmetTriggerCharacters = ['!', '.', '}', ':', '*', '$', ']', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

connection.onInitialize(async (params: InitializeParams) => {
    console.log(`laraphense started at ${new Date().toLocaleTimeString()}`);
    const folders: Array<WorkspaceFolder> = [];

    if (params.workspaceFolders) {
        params.workspaceFolders.forEach((folder) => {
            folders.push(new WorkspaceFolder(URI.parse(folder.uri).toString(), [], DEFAULT_EXCLUDE));
        });
    } else if (params.rootUri) {
        folders.push(new WorkspaceFolder(URI.parse(params.rootUri).toString(), [], DEFAULT_EXCLUDE));
    }

    laraphense = new Laraphense(new Workspace(folders));

    documents.onDidClose((e) => {
        laraphense.onDocumentRemoved(e.document);
    });
    connection.onShutdown(() => {
        laraphense.shutdown();
    });

    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: false,
                triggerCharacters: [...emmetTriggerCharacters, '.', ':', '<', '"', '=', '/'],
            },
        },
    };
});

connection.onInitialized(() => {
    laraphense.indexWorkspace(documents.keys());
});

connection.onDidChangeConfiguration((_change) => {
    laraphense.setConfig(_change.settings);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
    console.log('onDidChangeContent', change.document.uri);
});

documents.onDidOpen((params) => {
    console.log('onDidOpen', params.document.uri);
});

connection.onCompletion(async (textDocumentPosition, token) => {
    if (token.isCancellationRequested) {
        return;
    }
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
        return EMPTY_COMPLETION_LIST;
    }
    // return laraphense.provideCompletion(document, textDocumentPosition.position, textDocumentPosition.context);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

connection.listen();

