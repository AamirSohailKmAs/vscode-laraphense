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

export class Php implements Language {
    public id: DocLang = DocLang.php;
    private _providers: {
        documentSymbol: DocumentSymbolProvider;
    };

    constructor(private _workspace: Workspace, public indexer: Indexer) {
        this._providers = {
            documentSymbol: new DocumentSymbolProvider(),
        };

        this._workspace.folderAdded.addListener((data) => {
            this.indexer.indexFolder(data.folder);
        });
    }

    findDocumentSymbols(document: FlatDocument): SymbolInformation[] {
        let space = this.indexer.getProjectSpace(document.uri);

        if (!space) {
            // todo: wait for indexer to get ready
            console.warn('project folder not found', document.uri);
            return [];
        }

        return this._providers.documentSymbol.provide(
            space.project.symbolTable.findSymbolsByUri(space.fileUri),
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

    doResolve(document: FlatDocument, item: CompletionItem): CompletionItem {
        return item;
    }

    doHover(document: FlatDocument, position: Position): Hover | null {
        let space = this.indexer.getProjectSpace(document.uri);
        if (!space) {
            console.warn('project folder not found');
            return null;
        }

        console.log(
            space.project.referenceTable.findReferenceByOffsetInUri(space.fileUri, document.offsetAt(position))
        );
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

