'use strict';
import { DocContext, Language } from './baseLang';
import { DocLang, ASTDocument } from '../support/document';
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
            documentSymbol: new DocumentSymbolProvider(),
            hover: new HoverProvider(),
            definition: new DefinitionProvider(),
            reference: new ReferenceProvider(),
        };
    }

    public findDocumentSymbols(document: ASTDocument): SymbolInformation[] {
        let space = this._workspace.getProjectSpace(document.uri);
        if (!space) {
            return [];
        }
        return this._providers.documentSymbol.provide(space);
    }

    doComplete(
        document: ASTDocument,
        position: Position,
        context: DocContext
    ): CompletionList | Promise<CompletionList> {
        return CompletionList.create();
    }

    doResolve(document: ASTDocument, item: CompletionItem): CompletionItem {
        return item;
    }

    public doHover(document: ASTDocument, position: Position): Hover | null {
        let space = this._workspace.getProjectSpace(document.uri);
        if (!space) {
            return null;
        }
        return this._providers.hover.provide(document, position, space);
    }

    doSignatureHelp(document: ASTDocument, position: Position): SignatureHelp | null {
        return null;
    }

    doValidation(document: ASTDocument): Diagnostic[] | Promise<Diagnostic[]> {
        return [];
    }

    public findReferences(document: ASTDocument, position: Position): Location[] {
        let space = this._workspace.getProjectSpace(document.uri);
        if (!space) {
            return [];
        }
        return this._providers.reference.provide(document, position, space);
    }

    public findDefinition(document: ASTDocument, position: Position): Definition | null {
        let space = this._workspace.getProjectSpace(document.uri);
        if (!space) {
            return null;
        }
        return this._providers.definition.provide(document, position, space);
    }

    findDocumentHighlight(document: ASTDocument, position: Position): DocumentHighlight[] {
        return [];
    }

    findDocumentLinks(document: ASTDocument, documentContext: DocContext): DocumentLink[] {
        return [];
    }

    onDocumentRemoved(document: ASTDocument) {}

    dispose() {}
}

