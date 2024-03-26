'use strict';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocContext, Language } from './baseLang';
import { DocLang } from '../laraphense/document';
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
import { Workspace } from '../laraphense/indexing/workspace';
import { DocumentSymbolProvider } from './php/providers/documentSymbolProvider';

export class Php implements Language {
    id: DocLang = DocLang.php;

    private providers: {
        documentSymbol: DocumentSymbolProvider;
    };

    constructor(private _workspace: Workspace) {
        this.providers = {
            documentSymbol: new DocumentSymbolProvider(),
        };
    }

    findDocumentSymbols(document: TextDocument): SymbolInformation[] {
        const folder = this._workspace.findFolderContainingUri(document.uri);
        if (!folder) {
            return [];
        }

        return this.providers.documentSymbol.provide(
            folder.symbolTable.findSymbolsByFilePath(folder.relativePath(document.uri)),
            document.uri
        );
    }
    doComplete(
        document: TextDocument,
        position: Position,
        context: DocContext
    ): CompletionList | Promise<CompletionList> {
        return CompletionList.create();
    }
    doHover(document: TextDocument, position: Position): Hover | null {
        return null;
    }
    doResolve(document: TextDocument, item: CompletionItem): CompletionItem {
        return item;
    }
    doSignatureHelp(document: TextDocument, position: Position): SignatureHelp | null {
        return null;
    }
    doValidation(document: TextDocument): Diagnostic[] | Promise<Diagnostic[]> {
        return [];
    }
    findReferences(document: TextDocument, position: Position): Location[] {
        return [];
    }
    findDefinition(document: TextDocument, position: Position): Definition | null {
        return null;
    }
    findDocumentHighlight(document: TextDocument, position: Position): DocumentHighlight[] {
        return [];
    }
    findDocumentLinks(document: TextDocument, documentContext: DocContext): DocumentLink[] {
        return [];
    }

    onDocumentRemoved(document: TextDocument) {}

    dispose() {}
}

