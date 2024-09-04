'use strict';

import { EnvAST, EnvNode } from './envAst';

export class EnvParser {
    constructor() {}

    parse(content: string): EnvAST {
        const lines = content.split('\n');
        const children: EnvNode[] = [];
        let lineNumber = 0;
        let offset = 0;

        for (const line of lines) {
            lineNumber++;

            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const [key, ...valueParts] = trimmedLine.split('=');
                const value = valueParts.join('=').trim();

                children.push({
                    kind: 'keyValue',
                    key: key.trim(),

                    loc: {
                        start: { line: lineNumber, character: 0, offset },
                        end: { line: lineNumber, character: line.length, offset: offset },
                    },
                    value,
                });
            }
            offset += line.length;
        }

        return {
            kind: 'envFile',
            children,
            loc: {
                start: { line: 1, character: 0, offset: 0 },
                end: { line: lineNumber, character: lines[lines.length - 1].length, offset },
            },
        };
    }
}

