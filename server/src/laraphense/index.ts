'use strict';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Workspace } from './indexing/workspace';

export class Laraphense {
    constructor(private _workspace: Workspace) {}

    public shutdown() {}

    public onDocumentRemoved(document: TextDocument) {}
}
