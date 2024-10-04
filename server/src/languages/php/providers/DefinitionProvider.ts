'use strict';

import { Position, Definition } from 'vscode-languageserver';
import { toLSPRange } from '../../../helpers/symbol';
import { ASTDocument } from '../../../support/document';
import { Workspace } from '../../../support/workspace';

export class DefinitionProvider {
    constructor(private workspace: Workspace) {}

    provide(doc: ASTDocument, pos: Position): Definition | null {
        // @todo we can have multiple symbols for a reference but we are only have one symbolId

        const space = this.workspace.getProjectSpace(doc.uri);

        if (!space) return null;

        const ref = space.folder.referenceTable.findReferenceByOffsetInUri(space.fileUri, doc.offsetAt(pos));

        if (!ref) return null;

        const symbol = space.folder.symbolTable.getSymbolById(ref.symbolId);

        if (!symbol) return null;

        // @fixme symbol loc is not limited to name only
        const definition = { range: toLSPRange(symbol.loc), uri: space.folder.documentUri(symbol.uri) };

        return definition;
    }
}

