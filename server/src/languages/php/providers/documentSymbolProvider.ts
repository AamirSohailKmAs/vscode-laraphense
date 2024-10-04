'use strict';

import { SymbolInformation, SymbolKind as LSPSymbolKind } from 'vscode-languageserver';
import { PhpSymbol, PhpSymbolKind } from '../indexing/tables/symbolTable';
import { toLSPRange } from '../../../helpers/symbol';
import { Space } from '../../../support/workspaceFolder';

export class DocumentSymbolProvider {
    provide({ folder, fileUri, uri }: Space): SymbolInformation[] {
        const symbols = folder.symbolTable.findSymbolsByUri(fileUri);

        return symbols.map((symbol) => this.createSymbol(symbol, uri));
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

    toLSPSymbolKind(kind: PhpSymbolKind): LSPSymbolKind {
        switch (kind) {
            case PhpSymbolKind.File:
                return LSPSymbolKind.File;
            case PhpSymbolKind.Namespace:
                return LSPSymbolKind.Namespace;
            case PhpSymbolKind.Class:
                return LSPSymbolKind.Class;
            case PhpSymbolKind.Interface:
                return LSPSymbolKind.Interface;
            case PhpSymbolKind.Enum:
                return LSPSymbolKind.Enum;
            case PhpSymbolKind.Trait:
                return LSPSymbolKind.Module;
            case PhpSymbolKind.Method:
                return LSPSymbolKind.Method;
            case PhpSymbolKind.Property:
            case PhpSymbolKind.PromotedProperty:
                return LSPSymbolKind.Property;
            case PhpSymbolKind.Constructor:
                return LSPSymbolKind.Constructor;
            case PhpSymbolKind.Function:
                return LSPSymbolKind.Function;
            case PhpSymbolKind.Variable:
            case PhpSymbolKind.Parameter:
                return LSPSymbolKind.Variable;
            case PhpSymbolKind.Constant:
            case PhpSymbolKind.ClassConstant:
                return LSPSymbolKind.Constant;
            case PhpSymbolKind.String:
                return LSPSymbolKind.String;
            case PhpSymbolKind.Number:
                return LSPSymbolKind.Number;
            case PhpSymbolKind.Boolean:
                return LSPSymbolKind.Boolean;
            case PhpSymbolKind.Array:
                return LSPSymbolKind.Array;
            case PhpSymbolKind.Null:
                return LSPSymbolKind.Null;
            case PhpSymbolKind.EnumMember:
                return LSPSymbolKind.EnumMember;
            case PhpSymbolKind.Attribute:
                return LSPSymbolKind.Module;
            default:
                throw new Error('Unknown Kind ' + kind);
        }
    }
}

