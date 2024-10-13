'use strict';

import { SymbolInformation, SymbolKind as LSPSymbolKind } from 'vscode-languageserver';
import { PhpSymbol } from '../indexing/tables/symbolTable';
import { DefinitionKind } from '../../../helpers/symbol';
import { toLSPRange } from '../../../helpers/symbol';
import { Space } from '../../../support/workspaceFolder';

export class DocumentSymbolProvider {
    provide({ folder, fileUri, uri }: Space): SymbolInformation[] {
        const symbols = folder.db.symbolTable.findSymbolsByUri(fileUri);

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

    toLSPSymbolKind(kind: DefinitionKind): LSPSymbolKind {
        switch (kind) {
            case DefinitionKind.File:
                return LSPSymbolKind.File;
            case DefinitionKind.Namespace:
                return LSPSymbolKind.Namespace;
            case DefinitionKind.Class:
                return LSPSymbolKind.Class;
            case DefinitionKind.Interface:
                return LSPSymbolKind.Interface;
            case DefinitionKind.Enum:
                return LSPSymbolKind.Enum;
            case DefinitionKind.Trait:
                return LSPSymbolKind.Module;
            case DefinitionKind.Method:
                return LSPSymbolKind.Method;
            case DefinitionKind.Property:
            case DefinitionKind.PromotedProperty:
                return LSPSymbolKind.Property;
            case DefinitionKind.Constructor:
                return LSPSymbolKind.Constructor;
            case DefinitionKind.Function:
                return LSPSymbolKind.Function;
            case DefinitionKind.Variable:
            case DefinitionKind.Parameter:
                return LSPSymbolKind.Variable;
            case DefinitionKind.Constant:
            case DefinitionKind.ClassConstant:
                return LSPSymbolKind.Constant;
            case DefinitionKind.String:
                return LSPSymbolKind.String;
            case DefinitionKind.Number:
                return LSPSymbolKind.Number;
            case DefinitionKind.Boolean:
                return LSPSymbolKind.Boolean;
            case DefinitionKind.Array:
                return LSPSymbolKind.Array;
            case DefinitionKind.Null:
                return LSPSymbolKind.Null;
            case DefinitionKind.EnumMember:
                return LSPSymbolKind.EnumMember;
            case DefinitionKind.Attribute:
                return LSPSymbolKind.Module;
            default:
                throw new Error('Unknown Kind ' + kind);
        }
    }
}

