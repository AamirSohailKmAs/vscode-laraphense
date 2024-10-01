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
import { HoverProvider } from './php/providers/HoverProvider';
import { DefinitionProvider } from './php/providers/DefinitionProvider';
import { ReferenceProvider } from './php/providers/ReferenceProvider';

export class Php implements Language {
    public id: DocLang = DocLang.php;
    private _providers: {
        documentSymbol: DocumentSymbolProvider;
        hover: HoverProvider;
        definition: DefinitionProvider;
        reference: ReferenceProvider;
    };

    constructor(private _workspace: Workspace) {
        this._providers = {
            documentSymbol: new DocumentSymbolProvider(this._workspace),
            hover: new HoverProvider(this._workspace),
            definition: new DefinitionProvider(this._workspace),
            reference: new ReferenceProvider(this._workspace),
        };
    }

    public findDocumentSymbols(document: FlatDocument): SymbolInformation[] {
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

    public doHover(document: FlatDocument, position: Position): Hover | null {
        return this._providers.hover.provide(document, position);
    }

    doSignatureHelp(document: FlatDocument, position: Position): SignatureHelp | null {
        return null;
    }

    doValidation(document: FlatDocument): Diagnostic[] | Promise<Diagnostic[]> {
        return [];
    }

    public findReferences(document: FlatDocument, position: Position): Location[] {
        return this._providers.reference.provide(document, position);
    }

    public findDefinition(document: FlatDocument, position: Position): Definition | null {
        return this._providers.definition.provide(document, position);
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

