'use strict';
import { DocContext, Language } from './baseLang';
import { DocLang, FlatDocument } from '../laraphense/document';
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
import { Workspace } from '../laraphense/workspace';
import { DocumentSymbolProvider } from './php/providers/documentSymbolProvider';
import { Indexer } from './php/indexer';
import { Compiler } from '../laraphense/compiler';

export class Php implements Language {
    public id: DocLang = DocLang.php;

    private _indexer: Indexer;
    private providers: {
        documentSymbol: DocumentSymbolProvider;
    };

    constructor(private _workspace: Workspace, private _compiler: Compiler) {
        this._indexer = new Indexer(this._compiler, this._workspace.config);
        this.providers = {
            documentSymbol: new DocumentSymbolProvider(),
        };

        this._workspace.folderAdded.addListener((data) => {
            this._indexer.indexFolder(data.folder);
        });
    }

    findDocumentSymbols(document: FlatDocument): SymbolInformation[] {
        const folder = this._workspace.findFolderContainingUri(document.doc.uri);
        if (!folder) {
            console.log('folder not found');

            return [];
        }

        const symbolTable = this._indexer.symbolDb.get(folder.uri);

        if (!symbolTable) {
            console.log('symbolTable not found');

            return [];
        }

        return this.providers.documentSymbol.provide(
            symbolTable.findSymbolsByFilePath(folder.relativePath(document.doc.uri)),
            document.doc.uri
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

