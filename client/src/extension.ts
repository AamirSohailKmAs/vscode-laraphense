/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { ExtensionContext, workspace } from 'vscode';

import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

let client: LanguageClient;
const version = '0.1.0';
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
        synchronize: { fileEvents: workspace.createFileSystemWatcher('{composer,package}.json') },
        initializationOptions: {
            storagePath: context.storagePath,
            clearCache: context.globalState.get<string>('version') !== version,
            workspaceName: workspace.name ?? 'workspace',
        },
    };

    client = new LanguageClient('Laraphense', 'Laraphense', serverOptions, clientOptions);

    client.start();

    context.globalState.update('version', version);
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

