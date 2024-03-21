'use strict';

import { Position, CompletionList, CompletionItem } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocLang } from '../laraphense/document';
import { Package } from './basePackage';
import { lte } from 'semver';
import { WorkspaceFolder } from '../laraphense/indexing/workspaceFolder';

export type Snippet = {
    label: string;
    version: string;
    detail: string;
    doc: string;
    snippet: string;
};
export class Laravel implements Package {
    constructor(private version: string, private folder: WorkspaceFolder) {}

    public canComplete(languageId: DocLang): boolean {
        return [DocLang.php, DocLang.blade].includes(languageId);
    }

    public doComplete(document: TextDocument, position: Position): CompletionList {
        const items: CompletionItem[] = [];
        let isIncomplete = false;

        return CompletionList.create(items, isIncomplete);
    }

    private getSnippetsUpToVersion(allObjects: Snippet[]): Snippet[] {
        return allObjects.filter((obj) => {
            return lte(obj.version, this.version);
        });
    }
}

