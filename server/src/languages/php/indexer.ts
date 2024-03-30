'use strict';

import { DocumentUri } from 'vscode-languageserver';
import { laraphenseRc } from '../baseLang';
import { Compiler } from '../../laraphense/compiler';
import { DocLang } from '../../laraphense/document';
import { Fetcher } from '../../laraphense/fetcher';
import { FolderKind, FolderUri, WorkspaceFolder } from '../../laraphense/workspaceFolder';
import { SymbolKind, SymbolTable } from './indexing/tables/symbolTable';
import { Package } from '../../packages/basePackage';
import { toFqsen } from './indexing/symbol';
import { Laravel } from '../../packages/laravel';
export class Indexer {
    private _fetcher: Fetcher;
    public symbolDb: Map<FolderUri, SymbolTable> = new Map();
    public libraryDb: Map<FolderUri, Array<Package>> = new Map();
    private _indexCount: number = 0;

    constructor(private _compiler: Compiler, private config: laraphenseRc) {
        this._fetcher = new Fetcher();
    }

    public async indexFolder(folder: WorkspaceFolder) {
        const files = await folder.findFiles();

        console.log(`indexing Folder [${folder.uri}] having files [${files.length}]`);

        if (files.length < 1) {
            return;
        }

        const symbolTable = new SymbolTable();
        this.symbolDb.set(folder.uri, symbolTable);

        const missingFiles: Array<{ uri: string; reason: string }> = [];

        let count = 0;

        for (let i = 0; i < files.length; ++i) {
            const entry = files[i];
            if (entry.size > this.config.maxFileSize) {
                console.warn(
                    `${entry.uri} has ${entry.size} bytes which is over the maximum file size of ${this.config.maxFileSize} bytes.`
                );
                count++;
                continue;
            }

            const compiled = this.indexFile(entry.uri);
            if (!compiled) {
                continue;
            }

            symbolTable.addSymbols(compiled.symbols, folder.relativePath(entry.uri));

            count++;
            this._indexCount++;
        }

        this.initLibraries(folder);

        console.log(`folder [${folder.uri}] indexing completed with files [${count}]`);
        if (missingFiles.length > 0) {
            console.log('missingFiles', missingFiles);
        }
    }

    private indexFile(uri: DocumentUri) {
        const flatDoc = this._fetcher.loadUriIfLang(uri, [DocLang.php, DocLang.blade]);

        if (flatDoc === undefined) {
            return undefined;
        }

        return this._compiler.compileUri(flatDoc);
    }

    private initLibraries(folder: WorkspaceFolder) {
        if (folder.kind === FolderKind.Stub) {
            return;
        }
        this.enableLaravel(folder);
    }

    private enableLaravel(folder: WorkspaceFolder) {
        const symbolTable = this.symbolDb.get(folder.uri);
        if (!symbolTable) {
            return;
        }
        const classConst = toFqsen(SymbolKind.ClassConstant, 'VERSION', 'Illuminate\\Foundation\\Application');
        const version = symbolTable.getSymbolNested(classConst)?.value;
        if (version) {
            this.libraryDb.set(folder.uri, [new Laravel(version, folder)]);
        }
    }
}

