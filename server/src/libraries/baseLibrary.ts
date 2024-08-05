'use strict';

import { CompletionList, Position } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocLang } from '../support/document';

export type Library = {
    index: () => void;
    canComplete: (languageId: DocLang) => boolean;
    doComplete?: (document: TextDocument, position: Position) => CompletionList;
};

