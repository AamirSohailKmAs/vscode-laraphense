'use strict';

import { Position, CompletionList, CompletionItem } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocLang } from '../laraphense/document';
import { Package } from './basePackage';
import { lte } from 'semver';
import { WorkspaceFolder } from '../laraphense/workspaceFolder';
import { directives } from './laravel/directives';

export type Snippet = {
    label: string;
    version: string;
    detail: string;
    doc: string;
    snippet: string;
};
export class Laravel implements Package {
    constructor(private version: string, private folder: WorkspaceFolder) {
        this.index();
    }

    public canComplete(languageId: DocLang): boolean {
        return [DocLang.php, DocLang.blade].includes(languageId);
    }

    public doComplete(document: TextDocument, position: Position): CompletionList {
        const items: CompletionItem[] = [];
        let isIncomplete = false;
        const snippets = this.getSnippetsUpToVersion(directives);

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

    private async index() {
        // const entries = await this.folder.findFiles();
        // console.log(entries);
    }

    private getSnippetsUpToVersion(allObjects: Snippet[]): Snippet[] {
        return allObjects.filter((obj) => {
            return lte(obj.version, this.version);
        });
    }
}

