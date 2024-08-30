'use strict';

import { Position, CompletionList, CompletionItem } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocLang } from '../support/document';
import { Library } from './baseLibrary';
import { lte } from 'semver';
import { FolderUri } from '../support/workspaceFolder';
import { directives } from './laravel/directives';
import { Workspace } from '../support/workspace';
import { SymbolKind } from '../languages/php/indexing/tables/symbolTable';
import { Indexer } from '../languages/php/indexer';

export type Snippet = {
    label: string;
    version: string;
    detail: string;
    doc: string;
    snippet: string;
};
export class Laravel implements Library {
    private _versions: Map<FolderUri, string> = new Map();
    constructor(private _workspace: Workspace, private _indexer: Indexer) {
        this.index();
    }

    public canComplete(languageId: DocLang): boolean {
        return [DocLang.php, DocLang.blade].includes(languageId);
    }

    public doComplete(document: TextDocument, position: Position): CompletionList {
        const items: CompletionItem[] = [];
        let isIncomplete = false;
        const folderUri = this._workspace.findFolderUriContainingUri(document.uri);
        if (!folderUri) {
            return CompletionList.create(items, isIncomplete);
        }
        const version = this._versions.get(folderUri);
        if (!version) {
            return CompletionList.create(items, isIncomplete);
        }

        const snippets = this.getSnippetsUpToVersion(directives, version);

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
        // for (const [uri, folder] of this._workspace.folders) {
        //     // todo: wait for indexer to get ready
        //     let space = this._indexer.getProjectSpace(uri);
        //     if (!space) {
        //         console.warn('project folder not found', uri);
        //         return [];
        //     }
        //     const version = space.project.symbolTable.getSymbolNested(
        //         'VERSION',
        //         'Illuminate\\Foundation\\Application',
        //         SymbolKind.ClassConstant
        //     )?.value;
        //     if (!version) {
        //         continue;
        //     }
        //     console.log(`Laravel found v${version}`);
        //     this._versions.set(uri, version);
        //     console.log(space.project.files);
        //     // const entries = await folder.findFiles();
        //     // console.log(entries);
        // }
    }

    private getSnippetsUpToVersion(allObjects: Snippet[], version: string): Snippet[] {
        return allObjects.filter((obj) => {
            return lte(obj.version, version);
        });
    }
}

