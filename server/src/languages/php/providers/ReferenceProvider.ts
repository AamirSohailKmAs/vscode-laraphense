'use strict';

import { Position, Location } from 'vscode-languageserver';
import { toLSPRange } from '../../../helpers/symbol';
import { ASTDocument } from '../../../support/document';
import { Space } from '../../../support/workspaceFolder';

export class ReferenceProvider {
    provide(doc: ASTDocument, pos: Position, { folder, fileUri }: Space): Location[] {
        const items: Location[] = [];

        const symbol = folder.db.symbolTable.findSymbolByPositionOffsetInUri(fileUri, pos, doc.offsetAt(pos));

        if (!symbol) return items;

        const references = folder.db.referenceTable.getReferenceByIds(Array.from(symbol.referenceIds));

        return references.map((ref) => Location.create(folder.documentUri(ref.uri), toLSPRange(ref.loc)));
    }
}

