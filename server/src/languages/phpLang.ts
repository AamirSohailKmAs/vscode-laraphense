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
import { FileCache } from '../support/cache';
import { BladeParser } from '../bladeParser/parser';

export class Php implements Language {
    public id: DocLang = DocLang.php;
    public indexer: Indexer;

    private _providers: {
        documentSymbol: DocumentSymbolProvider;
    };

    constructor(private _workspace: Workspace, private _parser: BladeParser, _fileCache: FileCache | undefined) {
        this.indexer = new Indexer(this._parser, this._workspace.config, _fileCache);
        this._providers = {
            documentSymbol: new DocumentSymbolProvider(),
        };

        this._workspace.folderAdded.addListener((data) => {
            this.indexer.indexFolder(data.folder);
        });
    }

    findDocumentSymbols(document: FlatDocument): SymbolInformation[] {
        const uriParts = this._workspace.splitUri(document.uri);
        if (!uriParts) {
            console.log('folder not found');

            return [];
        }

        const symbolTable = this.indexer.symbolMap.get(uriParts.folderUri);

        if (!symbolTable) {
            // todo: wait for indexer to get ready
            console.log('symbolTable not found');

            return [];
        }

        return this._providers.documentSymbol.provide(symbolTable.findSymbolsByUri(uriParts.fileUri), document.uri);
    }
    doComplete(
        document: FlatDocument,
        position: Position,
        context: DocContext
    ): CompletionList | Promise<CompletionList> {
        return CompletionList.create();
    }

    doResolve(document: FlatDocument, item: CompletionItem): CompletionItem {
        return item;
    }

    doHover(document: FlatDocument, position: Position): Hover | null {
        let uriParts = this._workspace.splitUri(document.uri);
        if (!uriParts) {
            console.log('folder not found');

            return null;
        }

        const referenceTable = this.indexer.referenceMap.get(uriParts.folderUri);

        if (!referenceTable) {
            console.log('referenceTable not found');

            return null;
        }

        console.log(referenceTable.findReferenceByOffsetInUri(uriParts.fileUri, document.offsetAt(position)));
        return null;
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

