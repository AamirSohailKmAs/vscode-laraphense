'use strict';

import { DocumentUri } from 'vscode-languageserver';
import { ValueKind } from '../../helpers/symbol';
import { Fetcher } from '../../support/fetcher';
import { RelativeUri } from '../../support/workspaceFolder';
import { SymbolTable } from '../laravel';
import { PhpSymbolKind } from '../../languages/php/indexing/tables/symbolTable';
import { EnvParser, determineValueType } from '@porifa/env-parser';

export class Analyzer {
    private envParser: EnvParser = new EnvParser();

    constructor(private fetcher: Fetcher, private symbolTable: SymbolTable) {}

    analyzeEnv(fileUri: DocumentUri) {
        const envFile = this.fetcher.getFileContent(fileUri);
        if (!envFile) return;

        const ast = this.envParser.parse(envFile);

        ast.children.forEach((node) => {
            this.symbolTable.addSymbol({
                id: this.symbolTable.generateId(),
                name: node.key.text,
                uri: fileUri as RelativeUri,
                loc: node.key.loc,
                value: { kind: toValueKind(node.value.text), raw: node.key.text },
                scope: '',
                kind: PhpSymbolKind.File,
            });
        });
    }
}

function toValueKind(text: string) {
    switch (determineValueType(text)) {
        case 'Boolean':
            return ValueKind.Boolean;
        case 'Number':
            return ValueKind.Number;

        default:
            return ValueKind.String;
    }
}

