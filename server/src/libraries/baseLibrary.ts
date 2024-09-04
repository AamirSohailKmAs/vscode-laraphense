'use strict';

import { CompletionList, Position } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocLang } from '../support/document';

export type Library = {
    index: () => void;
    doComplete?: (languageId: DocLang, document: TextDocument, position: Position) => CompletionList;
};

