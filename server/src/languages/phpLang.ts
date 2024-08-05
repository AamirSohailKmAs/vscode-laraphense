'use strict';
import { DocContext, Language } from './baseLang';
import { DocLang, FlatDocument } from '../support/document';
import {
    CompletionItem,
    CompletionList,
    Definition,
    Diagnostic,
    DocumentHighlight,
    DocumentLink,
    Hover,
    Location,
    Position,
    SignatureHelp,
    SymbolInformation,
} from 'vscode-languageserver';
import { Workspace } from '../support/workspace';
import { DocumentSymbolProvider } from './php/providers/documentSymbolProvider';
import { Indexer } from './php/indexer';
import { Compiler } from '../support/compiler';
import { FileCache } from '../support/cache';

export class Php implements Language {
    public id: DocLang = DocLang.php;
    public indexer: Indexer;

    private _providers: {
        documentSymbol: DocumentSymbolProvider;
    };

    constructor(private _workspace: Workspace, private _compiler: Compiler, private _fileCache: FileCache | undefined) {
        this.indexer = new Indexer(this._compiler, this._workspace.config);
        this._providers = {
            documentSymbol: new DocumentSymbolProvider(),
        };

        this._workspace.folderAdded.addListener((data) => {
            this.indexer.indexFolder(data.folder);
        });
    }

    findDocumentSymbols(document: FlatDocument): SymbolInformation[] {
        const folder = this._workspace.findFolderContainingUri(document.uri);
        if (!folder) {
            console.log('folder not found');

            return [];
        }

        const symbolTable = this.indexer.symbolMap.get(folder.uri);

        if (!symbolTable) {
            console.log('symbolTable not found');

            return [];
        }

        return this._providers.documentSymbol.provide(
            symbolTable.findSymbolsByFilePath(folder.relativePath(document.uri)),
            document.uri
        );
    }
    doComplete(
        document: FlatDocument,
        position: Position,
        context: DocContext
    ): CompletionList | Promise<CompletionList> {
        return CompletionList.create();
    }
    doHover(document: FlatDocument, position: Position): Hover | null {
        const folder = this._workspace.findFolderContainingUri(document.uri);
        if (!folder) {
            console.log('folder not found');

            return null;
        }

        const referenceTable = this.indexer.referenceMap.get(folder.uri);

        if (!referenceTable) {
            console.log('referenceTable not found');

            return null;
        }

        console.log(document.getWordAtPosition(position), referenceTable);
        return null;
    }
    doResolve(document: FlatDocument, item: CompletionItem): CompletionItem {
        return item;
    }
    doSignatureHelp(document: FlatDocument, position: Position): SignatureHelp | null {
        return null;
    }
    doValidation(document: FlatDocument): Diagnostic[] | Promise<Diagnostic[]> {
        return [];
    }
    findReferences(document: FlatDocument, position: Position): Location[] {
        return [];
    }
    findDefinition(document: FlatDocument, position: Position): Definition | null {
        return null;
    }
    findDocumentHighlight(document: FlatDocument, position: Position): DocumentHighlight[] {
        return [];
    }
    findDocumentLinks(document: FlatDocument, documentContext: DocContext): DocumentLink[] {
        return [];
    }

    onDocumentRemoved(document: FlatDocument) {}

    dispose() {}
}

