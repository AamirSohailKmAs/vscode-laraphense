'use strict';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Workspace } from './indexing/workspace';
import { EMPTY_COMPLETION_LIST } from '../support/defaults';
import { doComplete as emmetDoComplete } from '@vscode/emmet-helper';
import { CompletionContext, CompletionList, Position } from 'vscode-languageserver';

export class Laraphense {
    constructor(private _workspace: Workspace) {}

    public provideCompletion(document: TextDocument, position: Position, context: CompletionContext | undefined) {
        const lang = this._workspace.getLangAtPosition(document, position);
        let result: CompletionList | undefined = EMPTY_COMPLETION_LIST;

        if (!lang || !lang.doComplete) {
            return result;
        }

        result = lang.doComplete(document, position, context);
        if (result.items.length > 0) {
            return result;
        }

        if (lang.emmetSyntax) {
            result = emmetDoComplete(document, position, lang.emmetSyntax, {});
        }

        return result;
    }

    public shutdown() {
        this._workspace.shutdown();
    }
}

