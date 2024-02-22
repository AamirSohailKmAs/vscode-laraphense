/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { ExtensionContext } from 'vscode';

import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

let client: LanguageClient;

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
    };

    client = new LanguageClient('Laraphense', 'Laraphense', serverOptions, clientOptions);

    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

