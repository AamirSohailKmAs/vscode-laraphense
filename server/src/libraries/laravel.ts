'use strict';

import { Position, CompletionList, CompletionItem } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocLang } from '../support/document';
import { Library } from './baseLibrary';
import { lte } from 'semver';
import { WorkspaceFolder } from '../support/workspaceFolder';
import { directives } from './laravel/directives';
import { existsSync, lstatSync, readdirSync } from 'fs-extra';
import { runSafe } from '../helpers/general';
import { PhpSymbolKind } from '../languages/php/indexing/tables/symbolTable';

export type Snippet = {
    label: string;
    version: string;
    detail: string;
    doc: string;
    snippet: string;
};
export class Laravel implements Library {
    private envMap: Map<string, string> = new Map();
    private envBackupMap: Map<string, string> = new Map();
    private publicFiles: Array<string> = [];
    constructor(private _folder: WorkspaceFolder, private _version: string) {
        this.index();
    }

    public doComplete(languageId: DocLang, document: TextDocument, position: Position): CompletionList {
        const items: CompletionItem[] = [];
        let isIncomplete = false;

        if (![DocLang.php, DocLang.blade].includes(languageId)) {
            return CompletionList.create(items, isIncomplete);
        }

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
        // get blade files without running the code
        // get config files without running the code
        this.envMap = await this.getEnvMap('.env');
        this.envBackupMap = await this.getEnvMap('.env.example');
        // get middlewares without running the code
        this.publicFiles = (await this.setPublicFiles('public')).map((path) => path.replace(/\/?public\/?/g, ''));
        // get routes without running the code
        // get translations without running the code
        // get view files without running the code
    }

    private async setPublicFiles(scanPath: string, depth: number = 0) {
        return await runSafe(
            async () => {
                if (depth > 10) {
                    throw new Error('Maximum recursion depth exceeded');
                }

                const projectScanPath = this._folder.documentPath(scanPath);

                if (!existsSync(uriToPath(projectScanPath))) {
                    return [];
                }

                const files: string[] = [];

                for (const filePath of readdirSync(projectScanPath)) {
                    const fullFilePath = `${projectScanPath}/${filePath}`;

                    const stat = lstatSync(fullFilePath);

                    if (stat.isDirectory()) {
                        files.push(...(await this.setPublicFiles(fullFilePath, depth + 1)));
                    } else if (stat.isFile() && !filePath.startsWith('.') && !filePath.endsWith('.php')) {
                        files.push(fullFilePath);
                    }
                }

                return files;
            },
            [],
            'Error while loading [.env] file data'
        );
    }

    async getEnvMap(fileName: string) {
        const envMap = new Map<string, string>();
        return await runSafe(
            () => {
                const envFile = this._folder.fetcher.getFileContent(this._folder.documentUri(fileName));
                if (!envFile) {
                    return envMap;
                }

                for (const line of envFile.split('\n')) {
                    const trimmedLine = line.trim();
                    if (trimmedLine && !trimmedLine.startsWith('#')) {
                        const parts = trimmedLine.split('=');
                        envMap.set(parts[0].trim(), parts.slice(1).join('=').trim());
                    }
                }

                return envMap;
            },
            envMap,
            'Error while loading [.env] file data'
        );
    }

    private getSnippetsUpToVersion(allObjects: Snippet[], version: string): Snippet[] {
        return allObjects.filter((obj) => {
            return lte(obj.version, version);
        });
    }

    public static make(folder: WorkspaceFolder) {
        const version = folder.symbolTable.getSymbolNested(
            'VERSION',
            'Illuminate\\Foundation\\Application',
            PhpSymbolKind.ClassConstant
        )?.value;
        if (!version) {
            return undefined;
        }
        return new Laravel(folder, version.raw);
    }
}

