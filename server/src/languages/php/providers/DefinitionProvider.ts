'use strict';

import { Position, Definition } from 'vscode-languageserver';
import { toLSPRange } from '../../../helpers/symbol';
import { ASTDocument } from '../../../support/document';
import { Space } from '../../../support/workspaceFolder';

export class DefinitionProvider {
    provide(doc: ASTDocument, pos: Position, { folder, fileUri }: Space): Definition | null {
        // @todo we can have multiple symbols for a reference but we are only have one symbolId

        const ref = folder.db.referenceTable.findReferenceByOffsetInUri(fileUri, doc.offsetAt(pos));

        if (!ref) return null;

        const symbol = folder.db.symbolTable.getSymbolById(ref.symbolId);

        if (!symbol) return null;

        // @fixme symbol loc is not limited to name only
        const definition = { range: toLSPRange(symbol.loc), uri: folder.documentUri(symbol.uri) };

        return definition;
    }
}

