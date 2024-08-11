'use strict';

import { DocumentUri, SymbolInformation, SymbolKind as LSPSymbolKind } from 'vscode-languageserver';
import { PhpSymbol, SymbolKind } from '../indexing/tables/symbolTable';
import { toLSPRange } from '../../../helpers/symbol';
import { Indexer } from '../indexer';
import { FlatDocument } from '../../../support/document';

export class DocumentSymbolProvider {
    constructor(private indexer: Indexer) {}

    provide(doc: FlatDocument): SymbolInformation[] {
        const symbolsInfo: SymbolInformation[] = [];

        let space = this.indexer.getProjectSpace(doc.uri);
        if (!space) return symbolsInfo;

        const symbols = space.project.symbolTable.findSymbolsByUri(space.fileUri);

        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];

            symbolsInfo.push(this.createSymbol(symbol, space.uri));
        }

        return symbolsInfo;
    }

    private createSymbol(symbol: PhpSymbol, uri: string) {
        return SymbolInformation.create(
            symbol.name,
            this.toLSPSymbolKind(symbol.kind),
            toLSPRange(symbol.loc),
            uri,
            this.getContainerName(symbol.scope)
        );
    }

    private getContainerName(name: string | undefined) {
        if (!name) {
            return undefined;
        }

        const names = name.split(':');
        if (names.length < 2) {
            return name;
        }

        return names[1].replace(/^[\(|\$]/, '');
    }

    toLSPSymbolKind(kind: SymbolKind): LSPSymbolKind {
        switch (kind) {
            case SymbolKind.File:
                return LSPSymbolKind.File;
            case SymbolKind.Namespace:
                return LSPSymbolKind.Namespace;
            case SymbolKind.Class:
                return LSPSymbolKind.Class;
            case SymbolKind.Interface:
                return LSPSymbolKind.Interface;
            case SymbolKind.Enum:
                return LSPSymbolKind.Enum;
            case SymbolKind.Trait:
                return LSPSymbolKind.Module;
            case SymbolKind.Method:
                return LSPSymbolKind.Method;
            case SymbolKind.Property:
            case SymbolKind.PromotedProperty:
                return LSPSymbolKind.Property;
            case SymbolKind.Constructor:
                return LSPSymbolKind.Constructor;
            case SymbolKind.Function:
                return LSPSymbolKind.Function;
            case SymbolKind.Variable:
            case SymbolKind.Parameter:
                return LSPSymbolKind.Variable;
            case SymbolKind.Constant:
            case SymbolKind.ClassConstant:
                return LSPSymbolKind.Constant;
            case SymbolKind.String:
                return LSPSymbolKind.String;
            case SymbolKind.Number:
                return LSPSymbolKind.Number;
            case SymbolKind.Boolean:
                return LSPSymbolKind.Boolean;
            case SymbolKind.Array:
                return LSPSymbolKind.Array;
            case SymbolKind.Null:
                return LSPSymbolKind.Null;
            case SymbolKind.EnumMember:
                return LSPSymbolKind.EnumMember;
        }
    }
}

