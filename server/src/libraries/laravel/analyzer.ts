'use strict';

import { DocumentUri } from 'vscode-languageserver';
import { ValueKind } from '../../helpers/symbol';
import { Fetcher } from '../../support/fetcher';
import { RelativeUri } from '../../support/workspaceFolder';
import { SymbolTable } from '../laravel';
import { EnvParser } from '../../parsers/envParser/parser';

export class Analyzer {
    private envParser: EnvParser = new EnvParser();

    constructor(private fetcher: Fetcher, private symbolTable: SymbolTable) {}

    analyzeEnv(fileUri: DocumentUri) {
        const envFile = this.fetcher.getFileContent(fileUri);
        if (!envFile) return;

        const ast = this.envParser.parse(envFile);
        if (ast.kind === 'errorNode' || !ast.children) return;

        for (let i = 0; i < ast.children.length; i++) {
            const node = ast.children[i];
            this.symbolTable.addSymbol({
                id: this.symbolTable.generateId(),
                name: node.key,
                uri: fileUri as RelativeUri,
                loc: node.loc,
                value: { kind: ValueKind.String, raw: node.value }, // todo:
            });
        }
    }
}

