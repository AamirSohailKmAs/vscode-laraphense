'use strict';

import { Position, Hover } from 'vscode-languageserver';
import { PhpSymbol } from '../indexing/tables/symbolTable';
import { toLSPRange } from '../../../helpers/symbol';
import { Indexer } from '../indexer';
import { FlatDocument } from '../../../support/document';

export class HoverProvider {
    constructor(private indexer: Indexer) {}

    provide(doc: FlatDocument, pos: Position): Hover | null {
        let space = this.indexer.getProjectSpace(doc.uri);

        if (!space) return null;

        const ref = space.project.referenceTable.findReferenceByOffsetInUri(space.fileUri, doc.offsetAt(pos));

        if (!ref) return null;

        const symbol = space.project.symbolTable.getSymbolById(ref.symbolId);

        if (!symbol) return null;

        return this.createHover(symbol);
    }

    private createHover(symbol: PhpSymbol): Hover {
        return { contents: { kind: 'markdown', value: symbol.name, language: 'php' }, range: toLSPRange(symbol.loc) };
    }
}

