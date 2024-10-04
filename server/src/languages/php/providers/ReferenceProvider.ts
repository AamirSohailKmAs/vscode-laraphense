'use strict';

import { Position, Location } from 'vscode-languageserver';
import { toLSPRange } from '../../../helpers/symbol';
import { ASTDocument } from '../../../support/document';
import { Workspace } from '../../../support/workspace';

export class ReferenceProvider {
    constructor(private workspace: Workspace) {}

    provide(doc: ASTDocument, pos: Position): Location[] {
        const items: Location[] = [];

        let space = this.workspace.getProjectSpace(doc.uri);

        if (!space) return items;

        const symbol = space.folder.symbolTable.findSymbolByPositionOffsetInUri(space.fileUri, pos, doc.offsetAt(pos));

        if (!symbol) return items;

        const references = space.folder.referenceTable.getReferenceByIds(Array.from(symbol.referenceIds));

        for (let i = 0; i < references.length; i++) {
            const ref = references[i];
            items.push({ range: toLSPRange(ref.loc), uri: space.folder.documentUri(ref.uri) });
        }

        return items;
    }
}

