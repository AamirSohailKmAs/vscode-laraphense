'use strict';

import { Position, Hover } from 'vscode-languageserver';
import { PhpSymbol, SymbolModifier } from '../indexing/tables/symbolTable';
import { DefinitionKind } from '../../../helpers/symbol';
import { toFqsen, toLSPRange } from '../../../helpers/symbol';
import { ASTDocument } from '../../../support/document';
import { Space, WorkspaceFolder } from '../../../support/workspaceFolder';
import { Location } from '../../../parsers/ast';

export class HoverProvider {
    private folder: WorkspaceFolder | undefined;

    provide(doc: ASTDocument, pos: Position, { folder, fileUri }: Space): Hover | null {
        this.folder = folder;

        const ref = folder.db.referenceTable.findReferenceByOffsetInUri(fileUri, doc.offsetAt(pos));

        if (!ref) {
            const symbol = folder.db.symbolTable.findSymbolByPositionOffsetInUri(fileUri, pos, doc.offsetAt(pos));
            if (!symbol) return null;
            return this.createHover(symbol, symbol.loc);
        }

        const symbol = folder.db.symbolTable.getSymbolById(ref.symbolId);

        if (!symbol) return null;

        return this.createHover(symbol, ref.loc);
    }

    private createHover(symbol: PhpSymbol, loc: Location): Hover {
        // todo: change the design of hover
        let value = `**Laraphense** \n\n`;
        value += `**${toFqsen(symbol).toString()}**\n`;
        value += ` \`\`\`php \n <?php \n`;

        switch (symbol.kind) {
            case DefinitionKind.Namespace:
                value += this.getMemberHover(symbol, 'namespace');
                break;
            case DefinitionKind.Class:
                value += this.getMemberHover(symbol, 'class');
                break;
            case DefinitionKind.Enum:
                value += this.getMemberHover(symbol, 'enum');
                break;
            case DefinitionKind.Interface:
                value += this.getMemberHover(symbol, 'interface');
                break;
            case DefinitionKind.Trait:
                value += this.getMemberHover(symbol, 'trait');
                break;
            case DefinitionKind.Method:
                value += this.getMethodHover(symbol);
                break;
            case DefinitionKind.Property:
                value += this.getPropertyHover(symbol);
                break;
            case DefinitionKind.ClassConstant:
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
            const relatedSymbols = this.folder.db.symbolTable.getSymbolsById(Array.from(symbol.relatedIds.values()));
            parameters = relatedSymbols
                .map((symbol: PhpSymbol) => {
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
}

