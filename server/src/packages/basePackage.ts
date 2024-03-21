'use strict';

import { CompletionList, Position } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocLang } from '../laraphense/document';

export type Package = {
    canComplete: (languageId: DocLang) => boolean;
    doComplete?: (document: TextDocument, position: Position) => CompletionList;
};

