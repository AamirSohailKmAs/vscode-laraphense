'use strict';

import { Position, CompletionList, CompletionItem } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocLang } from '../support/document';
import { Library } from './baseLibrary';
import { lte } from 'semver';
import { WorkspaceFolder } from '../support/workspaceFolder';
import { directives } from './laravel/directives';

export type Snippet = {
    label: string;
    version: string;
    detail: string;
    doc: string;
    snippet: string;
};
export class Laravel implements Library {
    constructor(private _folder: WorkspaceFolder, private _version: string) {}

    public canComplete(languageId: DocLang): boolean {
        return [DocLang.php, DocLang.blade].includes(languageId);
    }

    public doComplete(document: TextDocument, position: Position): CompletionList {
        const items: CompletionItem[] = [];
        let isIncomplete = false;

        const snippets = this.getSnippetsUpToVersion(directives, this._version);

        for (let snippet of snippets) {
            const doc = `**Laraphense** \n\n ${snippet.detail} \n\n \`\`\`blade \n ${snippet.doc} \n \`\`\` `;
            const item: CompletionItem = {
                label: snippet.label,
                insertText: snippet.snippet,
                documentation: { kind: 'markdown', value: doc },
            };

            items.push(item);
        }

        return CompletionList.create(items, isIncomplete);
    }

    public async index() {
        console.log(this._folder.files);
        // const entries = await folder.findFiles();
        // console.log(entries);
    }

    private getSnippetsUpToVersion(allObjects: Snippet[], version: string): Snippet[] {
        return allObjects.filter((obj) => {
            return lte(obj.version, version);
        });
    }
}

