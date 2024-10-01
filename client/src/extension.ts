/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { ExtensionContext, window, workspace } from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    NotificationType,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient';

let client: LanguageClient;
const version = '0.1.0';
const INDEXING_STARTED_NOTIFICATION = new NotificationType('indexingStarted');
const INDEXING_ENDED_NOTIFICATION = new NotificationType('indexingEnded');
export function activate(context: ExtensionContext) {
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

    const debugOptions = { execArgv: ['--nolazy', '--inspect=6060'] };

    const runOptions = { module: serverModule, transport: TransportKind.ipc };

    const serverOptions: ServerOptions = {
        run: runOptions,
        debug: { ...runOptions, options: debugOptions },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: ['blade', 'php'],
        synchronize: { fileEvents: workspace.createFileSystemWatcher('**') },
        initializationOptions: {
            storagePath: context.storagePath,
            clearCache: context.globalState.get<string>('version') !== version,
            workspaceName: workspace.name ?? 'porifa',
        },
    };

    client = new LanguageClient('Laraphense', 'Laraphense', serverOptions, clientOptions);

    client.start();

    client.onReady().then(() => {
        client.onNotification(INDEXING_STARTED_NOTIFICATION.method, (params) => {
            window.setStatusBarMessage(
                '$(sync~spin) Laraphense indexing ...',
                new Promise<void>((resolve, reject) => {
                    resolveIndexing = () => {
                        resolve();
                    };
                })
            );
        });

        client.onNotification(INDEXING_ENDED_NOTIFICATION.method, (params) => {
            if (resolveIndexing) {
                resolveIndexing();
            }
            resolveIndexing = undefined;
        });
    });

    context.globalState.update('version', version);
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

let resolveIndexing: () => void;

