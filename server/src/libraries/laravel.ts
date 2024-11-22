'use strict';

import { Position, CompletionList, CompletionItem, InsertTextFormat } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocLang } from '../support/document';
import { Library } from './baseLibrary';
import { lte } from 'semver';
import { WorkspaceFolder } from '../support/workspaceFolder';
import { directives } from './laravel/directives';
import { DefinitionKind } from '../helpers/symbol';
import { Indexer } from './laravel/Indexer';
import { LaravelRunner } from './laravel/LaravelRunner';

export type Snippet = {
    label: string;
    version: string;
    detail: string;
    doc: string;
    snippet: string;
};

export class Laravel implements Library {
    private indexer: Indexer;
    private runner: LaravelRunner;

    constructor(private _version: string, private _folder: WorkspaceFolder) {
        this.runner = new LaravelRunner(
            _folder.runner,
            this._folder.documentUri('vendor/autoload.php'), // @todo: allow different path
            this._folder.documentUri('bootstrap/app.php') // @todo: allow different path
        );
        this.indexer = new Indexer(_folder);
        this.index();
    }

    index() {
        this.indexer.index();
    }

    public doComplete(languageId: DocLang, document: TextDocument, position: Position): CompletionList {
        const items: CompletionItem[] = [];
        let isIncomplete = false;

        if (![DocLang.blade].includes(languageId)) {
            return CompletionList.create(items, isIncomplete);
        }
        // if (![DocLang.php, DocLang.blade].includes(languageId)) {
        //     return CompletionList.create(items, isIncomplete);
        // }

        const snippets = this.getSnippetsUpToVersion(directives, this._version);

        for (let snippet of snippets) {
            const doc = `**Laraphense** \n\n ${snippet.detail} \n\n \`\`\`blade \n ${snippet.doc} \n \`\`\` `;
            const item: CompletionItem = {
                label: snippet.label,
                insertText: snippet.snippet,
                insertTextFormat: InsertTextFormat.Snippet,
                documentation: { kind: 'markdown', value: doc },
            };

            items.push(item);
        }

        return CompletionList.create(items, isIncomplete);
    }

    private getSnippetsUpToVersion(allObjects: Snippet[], version: string): Snippet[] {
        return allObjects.filter((obj) => {
            return lte(obj.version, version);
        });
    }

    public static make(folder: WorkspaceFolder) {
        const version = folder.db.symbolTable.getSymbolNested(
            'VERSION',
            'Illuminate\\Foundation\\Application',
            DefinitionKind.ClassConstant
        )?.value;
        if (!version) {
            return undefined;
        }
        return new Laravel(version.raw.replace(/'|"/g, ''), folder);
    }
}

