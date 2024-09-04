'use strict';

import { Position, Hover } from 'vscode-languageserver';
import { PhpSymbol, PhpSymbolKind, SymbolModifier } from '../indexing/tables/symbolTable';
import { toFqsen, toLSPRange } from '../../../helpers/symbol';
import { FlatDocument } from '../../../support/document';
import { Workspace } from '../../../support/workspace';
import { WorkspaceFolder } from '../../../support/workspaceFolder';
import { Location } from '../../../parsers/ast';

export class HoverProvider {
    folder: WorkspaceFolder | undefined;
    constructor(private workspace: Workspace) {}

    provide(doc: FlatDocument, pos: Position): Hover | null {
        let space = this.workspace.getProjectSpace(doc.uri);

        if (!space) return null;
        this.folder = space.folder;

        const ref = space.folder.referenceTable.findReferenceByOffsetInUri(space.fileUri, doc.offsetAt(pos));

        if (!ref) {
            const symbol = space.folder.symbolTable.findSymbolByPositionOffsetInUri(
                space.fileUri,
                pos,
                doc.offsetAt(pos)
            );
            if (!symbol) return null;
            return this.createHover(symbol, symbol.loc);
        }

        const symbol = space.folder.symbolTable.getSymbolById(ref.symbolId);

        if (!symbol) return null;

        return this.createHover(symbol, ref.loc);
    }

    private createHover(symbol: PhpSymbol, loc: Location): Hover {
        let value = `**Laraphense** \n\n`;
        value += `**${this.fqsen(symbol)}**\n`;
        value += ` \`\`\`php \n <?php \n`;

        switch (symbol.kind) {
            case PhpSymbolKind.Namespace:
                value += this.getMemberHover(symbol, 'namespace');
                break;
            case PhpSymbolKind.Class:
                value += this.getMemberHover(symbol, 'class');
                break;
            case PhpSymbolKind.Enum:
                value += this.getMemberHover(symbol, 'enum');
                break;
            case PhpSymbolKind.Interface:
                value += this.getMemberHover(symbol, 'interface');
                break;
            case PhpSymbolKind.Trait:
                value += this.getMemberHover(symbol, 'trait');
                break;
            case PhpSymbolKind.Method:
                value += this.getMethodHover(symbol);
                break;
            case PhpSymbolKind.Property:
                value += this.getPropertyHover(symbol);
                break;
            case PhpSymbolKind.ClassConstant:
                value += this.getClassConstantHover(symbol);
                break;
            default:
                value += `${symbol.name} \n`;
                break;
        }
        value += `\`\`\` \n`;
        return { contents: { kind: 'markdown', value }, range: toLSPRange(loc) };
    }
    private getPropertyHover(symbol: PhpSymbol) {
        //todo: docblock, type, value
        let property = `${this.getModifier(symbol.modifiers)}`;

        if (symbol.type.declared) {
            property += `${symbol.type.declared.name}`;
        }

        property += `$${symbol.name}`;
        if (symbol.value) {
            property += ` = ${symbol.value.raw}`;
        }

        return `${property};\n`;
    }

    private getClassConstantHover(symbol: PhpSymbol) {
        //todo: docblock, type, value
        let property = `${this.getModifier(symbol.modifiers)} const ${symbol.name}`;
        if (symbol.value) {
            property += ` = ${symbol.value.raw}`;
        }

        return `${property};\n`;
    }
    private getMethodHover(symbol: PhpSymbol) {
        //todo: docblock, type, return type
        let parameters = '';
        if (this.folder) {
            const relatedSymbols = this.folder.symbolTable.getSymbolsById(symbol.relatedIds);
            parameters = relatedSymbols
                .map((symbol) => {
                    let property = `${this.getModifier(symbol.modifiers)}`;
                    if (symbol.type.declared) {
                        property += `${symbol.type.declared.name} `;
                    }
                    property += `$${symbol.name}`;
                    if (symbol.value) {
                        property += ` = ${symbol.value.raw}`;
                    }
                    return property;
                })
                .join(', ');
        }

        return `${this.getModifier(symbol.modifiers)} function ${symbol.name}(${parameters})\n`;
    }

    private getMemberHover(symbol: PhpSymbol, member: string) {
        let value = `use ${symbol.scope};\n\n`;
        value += `${this.getModifier(symbol.modifiers)} ${member} ${symbol.name} \n`;

        return value;
    }

    private getModifier(modifiers: SymbolModifier[]) {
        let value = '';
        modifiers.forEach((modifier) => {
            switch (modifier) {
                case SymbolModifier.Public:
                    value += 'public ';
                    break;
                case SymbolModifier.Protected:
                    value += 'protected ';
                    break;
                case SymbolModifier.Private:
                    value += 'private ';
                    break;
                case SymbolModifier.Static:
                    value += 'static ';
                    break;
                case SymbolModifier.Final:
                    value += 'final ';
                    break;
                case SymbolModifier.Abstract:
                    value += 'abstract ';
                    break;
                case SymbolModifier.ReadOnly:
                    value += 'readonly ';
                    break;
                case SymbolModifier.Magic:
                    value += '__ ';
                    break;
                case SymbolModifier.Nullable:
                    value += '? ';
                    break;
                case SymbolModifier.Variadic:
                    value += '... ';
                    break;
                default:
                    break;
            }
        });

        return value.trim();
    }

    private fqsen(symbol: PhpSymbol) {
        return toFqsen(symbol.kind, symbol.name, symbol.scope).toString();
    }
}

