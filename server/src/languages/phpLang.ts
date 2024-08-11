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
import { HoverProvider } from './php/providers/HoverProvider';

export class Php implements Language {
    public id: DocLang = DocLang.php;
    private _providers: {
        documentSymbol: DocumentSymbolProvider;
        hover: HoverProvider;
    };

    constructor(private _workspace: Workspace, public indexer: Indexer) {
        this._providers = {
            documentSymbol: new DocumentSymbolProvider(indexer),
            hover: new HoverProvider(indexer),
        };

        this._workspace.folderAdded.addListener((data) => {
            this.indexer.indexFolder(data.folder);
        });
    }

    findDocumentSymbols(document: FlatDocument): SymbolInformation[] {
        return this._providers.documentSymbol.provide(document);
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
        return this._providers.hover.provide(document, position);
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

