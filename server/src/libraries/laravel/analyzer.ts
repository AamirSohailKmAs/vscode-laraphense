'use strict';

import { ValueKind } from '../../helpers/symbol';
import { RelativeUri } from '../../support/workspaceFolder';
import { DefinitionKind } from '../../helpers/symbol';
import { EnvParser, determineValueType } from '@porifa/env-parser';
import { SymbolTable } from './Indexer';

export class Analyzer {
    private envParser: EnvParser = new EnvParser();

    constructor(private symbolTable: SymbolTable) {}

    analyzeEnv(envFile: string, uri: RelativeUri) {
        const ast = this.envParser.parse(envFile);

        ast.children.forEach((node) => {
            this.symbolTable.addSymbol({
                id: this.symbolTable.generateId(),
                name: node.key.text,
                uri,
                loc: node.key.loc,
                value: { kind: toValueKind(node.value.text), raw: node.key.text },
                scope: '',
                kind: DefinitionKind.File,
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

