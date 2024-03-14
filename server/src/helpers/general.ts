'use strict';
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function formatError(message: string, err: any): string {
    if (err instanceof Error) {
        let error = <Error>err;
        return `${message}: ${error.message}\n${error.stack}`;
    } else if (typeof err === 'string') {
        return `${message}: ${err}`;
    } else if (err) {
        return `${message}: ${err.toString()}`;
    }
    return message;
}

export function runSafe<T>(func: () => Thenable<T> | T, errorVal: T, errorMessage: string): Thenable<T> | T {
    try {
        let t = func();
        if (t instanceof Promise) {
            return t.then(void 0, (e) => {
                console.error(formatError(errorMessage, e));
                return errorVal;
            });
        }
        return t;
    } catch (e) {
        console.error(formatError(errorMessage, e));
        return errorVal;
    }
}

export function pushAll<T>(to: T[], from: T[]) {
    if (from) {
        for (var i = 0; i < from.length; i++) {
            to.push(from[i]);
        }
    }
}

export function getWordAtText(text: string, offset: number, wordDefinition: RegExp): { start: number; length: number } {
    let lineStart = offset;
    while (lineStart > 0 && !isNewlineCharacter(text.charCodeAt(lineStart - 1))) {
        lineStart--;
    }
    const offsetInLine = offset - lineStart;
    const lineText = text.substr(lineStart);

    // make a copy of the regex as to not keep the state
    const flags = wordDefinition.ignoreCase ? 'gi' : 'g';
    wordDefinition = new RegExp(wordDefinition.source, flags);

    let match = wordDefinition.exec(lineText);
    while (match && match.index + match[0].length < offsetInLine) {
        match = wordDefinition.exec(lineText);
    }
    if (match && match.index <= offsetInLine) {
        return { start: match.index + lineStart, length: match[0].length };
    }

    return { start: offset, length: 0 };
}

export function repeat(value: string, count: number) {
    let s = '';
    while (count > 0) {
        if ((count & 1) === 1) {
            s += value;
        }
        value += value;
        count = count >>> 1;
    }
    return s;
}

export function isWhitespaceOnly(str: string) {
    return /^\s*$/.test(str);
}

export function isEOL(content: string, offset: number) {
    return isNewlineCharacter(content.charCodeAt(offset));
}

const CR = '\r'.charCodeAt(0);
const NL = '\n'.charCodeAt(0);
export function isNewlineCharacter(charCode: number) {
    return charCode === CR || charCode === NL;
}

export function substituteWithWhitespace(
    result: string,
    start: number,
    end: number,
    oldContent: string,
    before: string,
    after: string
) {
    let accumulatedWS = 0;
    result += before;
    for (let i = start + before.length; i < end; i++) {
        const ch = oldContent[i];
        if (ch === '\n' || ch === '\r') {
            // only write new lines, skip the whitespace
            accumulatedWS = 0;
            result += ch;
        } else {
            accumulatedWS++;
        }
    }

    result = append(result, ' ', accumulatedWS - after.length);
    result += after;
    return result;
}

function append(result: string, str: string, n: number): string {
    while (n > 0) {
        if (n & 1) {
            result += str;
        }
        n >>= 1;
        str += str;
    }
    return result;
}
