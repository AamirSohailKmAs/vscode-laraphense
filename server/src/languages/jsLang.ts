/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as ts from 'typescript';
import { MemoryCache } from '../support/cache';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Language, Settings } from './baseLang';
import {
    Diagnostic,
    DiagnosticSeverity,
    SignatureInformation,
    SymbolKind,
    CompletionItem,
    Location,
    SignatureHelp,
    ParameterInformation,
    Definition,
    TextEdit,
    Range,
    CompletionItemKind,
    Hover,
    DocumentHighlight,
    DocumentHighlightKind,
    CompletionList,
    Position,
    FormattingOptions,
    FoldingRange,
    FoldingRangeKind,
    SelectionRange,
    SymbolInformation,
} from 'vscode-languageserver';
import { getWordAtText, isWhitespaceOnly, repeat } from '../helpers/general';
import { DocLang, FlatDocument, Regions } from '../laraphense/document';
import { DocumentContext } from 'vscode-html-languageservice';
import { join, basename, dirname } from 'path';
import { readFileSync } from 'fs';

const JS_WORD_REGEX = /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g;

export class Js implements Language {
    id: DocLang;
    jsDocuments: MemoryCache<FlatDocument>;
    host: {
        getLanguageService(jsDocument: TextDocument): ts.LanguageService;
        getCompilationSettings(): ts.CompilerOptions;
        dispose(): void;
    };
    constructor(
        private regions: MemoryCache<Regions>,
        private languageId: DocLang.js | DocLang.ts,
        private settings: Settings
    ) {
        this.id = languageId;
        this.jsDocuments = new MemoryCache((document) =>
            regions.get(document).getEmbeddedDocument(document, languageId)
        );
        this.host = getLanguageServiceHost(languageId === DocLang.js ? ts.ScriptKind.JS : ts.ScriptKind.TS);
    }

    updateHostSettings(settings: Settings) {
        const hostSettings = this.host.getCompilationSettings();
        hostSettings.experimentalDecorators = settings?.['js/ts']?.implicitProjectConfig?.experimentalDecorators;
        hostSettings.strictNullChecks = settings?.['js/ts']?.implicitProjectConfig?.strictNullChecks;
    }

    async doValidation(document: FlatDocument): Promise<Diagnostic[]> {
        const jsDocument = this.jsDocuments.get(document);
        const languageService = this.host.getLanguageService(jsDocument.doc);
        const syntaxDiagnostics: ts.Diagnostic[] = languageService.getSyntacticDiagnostics(jsDocument.uri);
        const semanticDiagnostics = languageService.getSemanticDiagnostics(jsDocument.uri);
        return syntaxDiagnostics
            .concat(semanticDiagnostics)
            .filter((d) => !ignoredErrors.includes(d.code))
            .map((diag: ts.Diagnostic): Diagnostic => {
                return {
                    range: convertRange(jsDocument.doc, diag),
                    severity: DiagnosticSeverity.Error,
                    source: this.languageId,
                    message: ts.flattenDiagnosticMessageText(diag.messageText, '\n'),
                };
            });
    }
    doComplete(document: FlatDocument, position: Position, _documentContext: DocumentContext): CompletionList {
        const jsDocument = this.jsDocuments.get(document);
        const jsLanguageService = this.host.getLanguageService(jsDocument.doc);
        const offset = jsDocument.offsetAt(position);
        const completions = jsLanguageService.getCompletionsAtPosition(jsDocument.uri, offset, {
            includeExternalModuleExports: false,
            includeInsertTextCompletions: false,
        });
        if (!completions) {
            return { isIncomplete: false, items: [] };
        }
        const replaceRange = convertRange(jsDocument.doc, getWordAtText(jsDocument.getText(), offset, JS_WORD_REGEX));
        return {
            isIncomplete: false,
            items: completions.entries.map((entry) => {
                const data: CompletionItemData = {
                    // data used for resolving item details (see 'doResolve')
                    languageId: this.languageId,
                    uri: document.uri,
                    offset: offset,
                };
                return {
                    uri: document.uri,
                    position: position,
                    label: entry.name,
                    sortText: entry.sortText,
                    kind: convertKind(entry.kind),
                    textEdit: TextEdit.replace(replaceRange, entry.name),
                    data,
                };
            }),
        };
    }
    doResolve(document: FlatDocument, item: CompletionItem): CompletionItem {
        if (isCompletionItemData(item.data)) {
            const jsDocument = this.jsDocuments.get(document);
            const jsLanguageService = this.host.getLanguageService(jsDocument.doc);
            const details = jsLanguageService.getCompletionEntryDetails(
                jsDocument.uri,
                item.data.offset,
                item.label,
                undefined,
                undefined,
                undefined,
                undefined
            );
            if (details) {
                item.detail = ts.displayPartsToString(details.displayParts);
                item.documentation = ts.displayPartsToString(details.documentation);
                delete item.data;
            }
        }
        return item;
    }
    doHover(document: FlatDocument, position: Position): Hover | null {
        const jsDocument = this.jsDocuments.get(document);
        const jsLanguageService = this.host.getLanguageService(jsDocument.doc);
        const info = jsLanguageService.getQuickInfoAtPosition(jsDocument.uri, jsDocument.offsetAt(position));
        if (info) {
            const contents = ts.displayPartsToString(info.displayParts);
            return {
                range: convertRange(jsDocument.doc, info.textSpan),
                contents: ['```typescript', contents, '```'].join('\n'),
            };
        }
        return null;
    }
    doSignatureHelp(document: FlatDocument, position: Position): SignatureHelp | null {
        const jsDocument = this.jsDocuments.get(document);
        const jsLanguageService = this.host.getLanguageService(jsDocument.doc);
        const signHelp = jsLanguageService.getSignatureHelpItems(
            jsDocument.uri,
            jsDocument.offsetAt(position),
            undefined
        );
        if (signHelp) {
            const ret: SignatureHelp = {
                activeSignature: signHelp.selectedItemIndex,
                activeParameter: signHelp.argumentIndex,
                signatures: [],
            };
            signHelp.items.forEach((item) => {
                const signature: SignatureInformation = {
                    label: '',
                    documentation: undefined,
                    parameters: [],
                };

                signature.label += ts.displayPartsToString(item.prefixDisplayParts);
                item.parameters.forEach((p, i, a) => {
                    const label = ts.displayPartsToString(p.displayParts);
                    const parameter: ParameterInformation = {
                        label: label,
                        documentation: ts.displayPartsToString(p.documentation),
                    };
                    signature.label += label;
                    signature.parameters!.push(parameter);
                    if (i < a.length - 1) {
                        signature.label += ts.displayPartsToString(item.separatorDisplayParts);
                    }
                });
                signature.label += ts.displayPartsToString(item.suffixDisplayParts);
                ret.signatures.push(signature);
            });
            return ret;
        }
        return null;
    }
    doRename(document: FlatDocument, position: Position, newName: string) {
        const jsDocument = this.jsDocuments.get(document);
        const jsLanguageService = this.host.getLanguageService(jsDocument.doc);
        const jsDocumentPosition = jsDocument.offsetAt(position);
        const { canRename } = jsLanguageService.getRenameInfo(jsDocument.uri, jsDocumentPosition);
        if (!canRename) {
            return null;
        }
        const renameInfos = jsLanguageService.findRenameLocations(jsDocument.uri, jsDocumentPosition, false, false);

        const edits: TextEdit[] = [];
        renameInfos?.map((renameInfo) => {
            edits.push({
                range: convertRange(jsDocument.doc, renameInfo.textSpan),
                newText: newName,
            });
        });

        return {
            changes: { [document.uri]: edits },
        };
    }
    findDocumentHighlight(document: FlatDocument, position: Position): DocumentHighlight[] {
        const jsDocument = this.jsDocuments.get(document);
        const jsLanguageService = this.host.getLanguageService(jsDocument.doc);
        const highlights = jsLanguageService.getDocumentHighlights(jsDocument.uri, jsDocument.offsetAt(position), [
            jsDocument.uri,
        ]);
        const out: DocumentHighlight[] = [];
        for (const entry of highlights || []) {
            for (const highlight of entry.highlightSpans) {
                out.push({
                    range: convertRange(jsDocument.doc, highlight.textSpan),
                    kind:
                        highlight.kind === 'writtenReference'
                            ? DocumentHighlightKind.Write
                            : DocumentHighlightKind.Text,
                });
            }
        }
        return out;
    }
    findDocumentSymbols(document: FlatDocument): SymbolInformation[] {
        const jsDocument = this.jsDocuments.get(document);
        const jsLanguageService = this.host.getLanguageService(jsDocument.doc);
        const items = jsLanguageService.getNavigationBarItems(jsDocument.uri);
        if (items) {
            const result: SymbolInformation[] = [];
            const existing = Object.create(null);
            const collectSymbols = (item: ts.NavigationBarItem, containerLabel?: string) => {
                const sig = item.text + item.kind + item.spans[0].start;
                if (item.kind !== 'script' && !existing[sig]) {
                    const symbol: SymbolInformation = {
                        name: item.text,
                        kind: convertSymbolKind(item.kind),
                        location: {
                            uri: document.uri,
                            range: convertRange(jsDocument.doc, item.spans[0]),
                        },
                        containerName: containerLabel,
                    };
                    existing[sig] = true;
                    result.push(symbol);
                    containerLabel = item.text;
                }

                if (item.childItems && item.childItems.length > 0) {
                    for (const child of item.childItems) {
                        collectSymbols(child, containerLabel);
                    }
                }
            };

            items.forEach((item) => collectSymbols(item));
            return result;
        }
        return [];
    }
    findDefinition(document: FlatDocument, position: Position): Definition | null {
        const jsDocument = this.jsDocuments.get(document);
        const jsLanguageService = this.host.getLanguageService(jsDocument.doc);
        const definition = jsLanguageService.getDefinitionAtPosition(jsDocument.uri, jsDocument.offsetAt(position));
        if (definition) {
            return definition
                .filter((d) => d.fileName === jsDocument.uri)
                .map((d) => {
                    return {
                        uri: document.uri,
                        range: convertRange(jsDocument.doc, d.textSpan),
                    };
                });
        }
        return null;
    }
    findReferences(document: FlatDocument, position: Position): Location[] {
        const jsDocument = this.jsDocuments.get(document);
        const jsLanguageService = this.host.getLanguageService(jsDocument.doc);
        const references = jsLanguageService.getReferencesAtPosition(jsDocument.uri, jsDocument.offsetAt(position));
        if (references) {
            return references
                .filter((d) => d.fileName === jsDocument.uri)
                .map((d) => {
                    return {
                        uri: document.uri,
                        range: convertRange(jsDocument.doc, d.textSpan),
                    };
                });
        }
        return [];
    }
    getSelectionRange(document: FlatDocument, position: Position): SelectionRange {
        const jsDocument = this.jsDocuments.get(document);
        const jsLanguageService = this.host.getLanguageService(jsDocument.doc);
        function convertSelectionRange(selectionRange: ts.SelectionRange): SelectionRange {
            const parent = selectionRange.parent ? convertSelectionRange(selectionRange.parent) : undefined;
            return SelectionRange.create(convertRange(jsDocument.doc, selectionRange.textSpan), parent);
        }
        const range = jsLanguageService.getSmartSelectionRange(jsDocument.uri, jsDocument.offsetAt(position));
        return convertSelectionRange(range);
    }
    format(document: FlatDocument, range: Range, formatParams: FormattingOptions): TextEdit[] {
        const jsDocument = this.regions.get(document).getEmbeddedDocument(document, DocLang.js, true);
        const jsLanguageService = this.host.getLanguageService(jsDocument.doc);

        const formatterSettings = this.settings && this.settings.javascript && this.settings.javascript.format;

        const initialIndentLevel = computeInitialIndent(document.doc, range, formatParams);
        const formatSettings = convertOptions(formatParams, formatterSettings, initialIndentLevel + 1);
        const start = jsDocument.offsetAt(range.start);
        let end = jsDocument.offsetAt(range.end);
        let lastLineRange = null;
        if (
            range.end.line > range.start.line &&
            (range.end.character === 0 ||
                isWhitespaceOnly(jsDocument.getText().substr(end - range.end.character, range.end.character)))
        ) {
            end -= range.end.character;
            lastLineRange = Range.create(Position.create(range.end.line, 0), range.end);
        }
        const edits = jsLanguageService.getFormattingEditsForRange(jsDocument.uri, start, end, formatSettings);
        if (edits) {
            const result = [];
            for (const edit of edits) {
                if (edit.span.start >= start && edit.span.start + edit.span.length <= end) {
                    result.push({
                        range: convertRange(jsDocument.doc, edit.span),
                        newText: edit.newText,
                    });
                }
            }
            if (lastLineRange) {
                result.push({
                    range: lastLineRange,
                    newText: generateIndent(initialIndentLevel, formatParams),
                });
            }
            return result;
        }
        return [];
    }
    async getFoldingRanges(document: FlatDocument): Promise<FoldingRange[]> {
        const jsDocument = this.jsDocuments.get(document);
        const jsLanguageService = this.host.getLanguageService(jsDocument.doc);
        const spans = jsLanguageService.getOutliningSpans(jsDocument.uri);
        const ranges: FoldingRange[] = [];
        for (const span of spans) {
            const curr = convertRange(jsDocument.doc, span.textSpan);
            const startLine = curr.start.line;
            const endLine = curr.end.line;
            if (startLine < endLine) {
                const foldingRange: FoldingRange = { startLine, endLine };
                const match = document.getText(curr).match(/^\s*\/(?:(\/\s*#(?:end)?region\b)|(\*|\/))/);
                if (match) {
                    foldingRange.kind = match[1] ? FoldingRangeKind.Region : FoldingRangeKind.Comment;
                }
                ranges.push(foldingRange);
            }
        }
        return ranges;
    }
    onDocumentRemoved(document: FlatDocument) {
        this.jsDocuments.delete(document.uri);
    }
    dispose() {
        this.host.dispose();
        this.jsDocuments.clear();
    }
}

const contents: { [name: string]: string } = {};

const serverFolder = basename(__dirname) === 'dist' ? dirname(__dirname) : dirname(dirname(__dirname));

const TYPESCRIPT_LIB_SOURCE = join(serverFolder, '../node_modules/typescript/lib');
const JQUERY_PATH = join(serverFolder, 'lib/jquery.d.ts');

export function loadLibrary(name: string) {
    let content = contents[name];
    if (typeof content !== 'string') {
        let libPath;
        if (name === 'jquery') {
            libPath = JQUERY_PATH;
        } else {
            libPath = join(TYPESCRIPT_LIB_SOURCE, name); // from source
        }
        try {
            content = readFileSync(libPath).toString();
        } catch (e) {
            console.log(`Unable to load library ${name} at ${libPath}`);
            content = '';
        }
        contents[name] = content;
    }
    return content;
}
function getLanguageServiceHost(scriptKind: ts.ScriptKind) {
    const compilerOptions: ts.CompilerOptions = {
        allowNonTsExtensions: true,
        allowJs: true,
        lib: ['lib.es2020.full.d.ts'],
        target: ts.ScriptTarget.Latest,
        moduleResolution: ts.ModuleResolutionKind.Classic,
        experimentalDecorators: false,
    };

    let currentTextDocument = TextDocument.create('init', 'javascript', 1, '');
    const host: ts.LanguageServiceHost = {
        getCompilationSettings: () => compilerOptions,
        getScriptFileNames: () => [currentTextDocument.uri, 'jquery'],
        getScriptKind: (fileName) => {
            if (fileName === currentTextDocument.uri) {
                return scriptKind;
            }
            return fileName.substr(fileName.length - 2) === 'ts' ? ts.ScriptKind.TS : ts.ScriptKind.JS;
        },
        getScriptVersion: (fileName: string) => {
            if (fileName === currentTextDocument.uri) {
                return String(currentTextDocument.version);
            }
            return '1'; // default lib an jquery.d.ts are static
        },
        getScriptSnapshot: (fileName: string) => {
            let text = '';
            if (fileName === currentTextDocument.uri) {
                text = currentTextDocument.getText();
            } else {
                text = loadLibrary(fileName);
            }
            return {
                getText: (start, end) => text.substring(start, end),
                getLength: () => text.length,
                getChangeRange: () => undefined,
            };
        },
        getCurrentDirectory: () => '',
        getDefaultLibFileName: (_options: ts.CompilerOptions) => 'es2020.full',
        readFile: (path: string, _encoding?: string | undefined): string | undefined => {
            if (path === currentTextDocument.uri) {
                return currentTextDocument.getText();
            } else {
                return loadLibrary(path);
            }
        },
        fileExists: (path: string): boolean => {
            if (path === currentTextDocument.uri) {
                return true;
            } else {
                return !!loadLibrary(path);
            }
        },
        directoryExists: (path: string): boolean => {
            // typescript tries to first find libraries in node_modules/@types and node_modules/@typescript
            // there's no node_modules in our setup
            if (path.startsWith('node_modules')) {
                return false;
            }
            return true;
        },
    };
    const jsLanguageService = ts.createLanguageService(host);
    return {
        getLanguageService(jsDocument: TextDocument) {
            currentTextDocument = jsDocument;
            return jsLanguageService;
        },
        getCompilationSettings() {
            return compilerOptions;
        },
        dispose() {
            jsLanguageService.dispose();
        },
    };
}

const ignoredErrors = [
    1108 /* A_return_statement_can_only_be_used_within_a_function_body_1108 */,
    2792 /* Cannot_find_module_0_Did_you_mean_to_set_the_moduleResolution_option_to_node_or_to_add_aliases_to_the_paths_option */,
];

function convertRange(document: TextDocument, span: { start: number | undefined; length: number | undefined }): Range {
    if (typeof span.start === 'undefined') {
        const pos = document.positionAt(0);
        return Range.create(pos, pos);
    }
    const startPosition = document.positionAt(span.start);
    const endPosition = document.positionAt(span.start + (span.length || 0));
    return Range.create(startPosition, endPosition);
}

function convertKind(kind: string): CompletionItemKind {
    switch (kind) {
        case Kind.primitiveType:
        case Kind.keyword:
            return CompletionItemKind.Keyword;

        case Kind.const:
        case Kind.let:
        case Kind.variable:
        case Kind.localVariable:
        case Kind.alias:
        case Kind.parameter:
            return CompletionItemKind.Variable;

        case Kind.memberVariable:
        case Kind.memberGetAccessor:
        case Kind.memberSetAccessor:
            return CompletionItemKind.Field;

        case Kind.function:
        case Kind.localFunction:
            return CompletionItemKind.Function;

        case Kind.method:
        case Kind.constructSignature:
        case Kind.callSignature:
        case Kind.indexSignature:
            return CompletionItemKind.Method;

        case Kind.enum:
            return CompletionItemKind.Enum;

        case Kind.enumMember:
            return CompletionItemKind.EnumMember;

        case Kind.module:
        case Kind.externalModuleName:
            return CompletionItemKind.Module;

        case Kind.class:
        case Kind.type:
            return CompletionItemKind.Class;

        case Kind.interface:
            return CompletionItemKind.Interface;

        case Kind.warning:
            return CompletionItemKind.Text;

        case Kind.script:
            return CompletionItemKind.File;

        case Kind.directory:
            return CompletionItemKind.Folder;

        case Kind.string:
            return CompletionItemKind.Constant;

        default:
            return CompletionItemKind.Property;
    }
}
const enum Kind {
    alias = 'alias',
    callSignature = 'call',
    class = 'class',
    const = 'const',
    constructorImplementation = 'constructor',
    constructSignature = 'construct',
    directory = 'directory',
    enum = 'enum',
    enumMember = 'enum member',
    externalModuleName = 'external module name',
    function = 'function',
    indexSignature = 'index',
    interface = 'interface',
    keyword = 'keyword',
    let = 'let',
    localFunction = 'local function',
    localVariable = 'local var',
    method = 'method',
    memberGetAccessor = 'getter',
    memberSetAccessor = 'setter',
    memberVariable = 'property',
    module = 'module',
    primitiveType = 'primitive type',
    script = 'script',
    type = 'type',
    variable = 'var',
    warning = 'warning',
    string = 'string',
    parameter = 'parameter',
    typeParameter = 'type parameter',
}

function convertSymbolKind(kind: string): SymbolKind {
    switch (kind) {
        case Kind.module:
            return SymbolKind.Module;
        case Kind.class:
            return SymbolKind.Class;
        case Kind.enum:
            return SymbolKind.Enum;
        case Kind.enumMember:
            return SymbolKind.EnumMember;
        case Kind.interface:
            return SymbolKind.Interface;
        case Kind.indexSignature:
            return SymbolKind.Method;
        case Kind.callSignature:
            return SymbolKind.Method;
        case Kind.method:
            return SymbolKind.Method;
        case Kind.memberVariable:
            return SymbolKind.Property;
        case Kind.memberGetAccessor:
            return SymbolKind.Property;
        case Kind.memberSetAccessor:
            return SymbolKind.Property;
        case Kind.variable:
            return SymbolKind.Variable;
        case Kind.let:
            return SymbolKind.Variable;
        case Kind.const:
            return SymbolKind.Variable;
        case Kind.localVariable:
            return SymbolKind.Variable;
        case Kind.alias:
            return SymbolKind.Variable;
        case Kind.function:
            return SymbolKind.Function;
        case Kind.localFunction:
            return SymbolKind.Function;
        case Kind.constructSignature:
            return SymbolKind.Constructor;
        case Kind.constructorImplementation:
            return SymbolKind.Constructor;
        case Kind.typeParameter:
            return SymbolKind.TypeParameter;
        case Kind.string:
            return SymbolKind.String;
        default:
            return SymbolKind.Variable;
    }
}

function convertOptions(
    options: FormattingOptions,
    formatSettings: any,
    initialIndentLevel: number
): ts.FormatCodeSettings {
    return {
        convertTabsToSpaces: options.insertSpaces,
        tabSize: options.tabSize,
        indentSize: options.tabSize,
        indentStyle: ts.IndentStyle.Smart,
        newLineCharacter: '\n',
        baseIndentSize: options.tabSize * initialIndentLevel,
        insertSpaceAfterCommaDelimiter: Boolean(!formatSettings || formatSettings.insertSpaceAfterCommaDelimiter),
        insertSpaceAfterConstructor: Boolean(formatSettings && formatSettings.insertSpaceAfterConstructor),
        insertSpaceAfterSemicolonInForStatements: Boolean(
            !formatSettings || formatSettings.insertSpaceAfterSemicolonInForStatements
        ),
        insertSpaceBeforeAndAfterBinaryOperators: Boolean(
            !formatSettings || formatSettings.insertSpaceBeforeAndAfterBinaryOperators
        ),
        insertSpaceAfterKeywordsInControlFlowStatements: Boolean(
            !formatSettings || formatSettings.insertSpaceAfterKeywordsInControlFlowStatements
        ),
        insertSpaceAfterFunctionKeywordForAnonymousFunctions: Boolean(
            !formatSettings || formatSettings.insertSpaceAfterFunctionKeywordForAnonymousFunctions
        ),
        insertSpaceBeforeFunctionParenthesis: Boolean(
            formatSettings && formatSettings.insertSpaceBeforeFunctionParenthesis
        ),
        insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: Boolean(
            formatSettings && formatSettings.insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis
        ),
        insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: Boolean(
            formatSettings && formatSettings.insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets
        ),
        insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: Boolean(
            formatSettings && formatSettings.insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces
        ),
        insertSpaceAfterOpeningAndBeforeClosingEmptyBraces: Boolean(
            !formatSettings || formatSettings.insertSpaceAfterOpeningAndBeforeClosingEmptyBraces
        ),
        insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: Boolean(
            formatSettings && formatSettings.insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces
        ),
        insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: Boolean(
            formatSettings && formatSettings.insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces
        ),
        insertSpaceAfterTypeAssertion: Boolean(formatSettings && formatSettings.insertSpaceAfterTypeAssertion),
        placeOpenBraceOnNewLineForControlBlocks: Boolean(
            formatSettings && formatSettings.placeOpenBraceOnNewLineForFunctions
        ),
        placeOpenBraceOnNewLineForFunctions: Boolean(
            formatSettings && formatSettings.placeOpenBraceOnNewLineForControlBlocks
        ),
        semicolons: formatSettings?.semicolons,
    };
}

function computeInitialIndent(document: TextDocument, range: Range, options: FormattingOptions) {
    const lineStart = document.offsetAt(Position.create(range.start.line, 0));
    const content = document.getText();

    let i = lineStart;
    let nChars = 0;
    const tabSize = options.tabSize || 4;
    while (i < content.length) {
        const ch = content.charAt(i);
        if (ch === ' ') {
            nChars++;
        } else if (ch === '\t') {
            nChars += tabSize;
        } else {
            break;
        }
        i++;
    }
    return Math.floor(nChars / tabSize);
}

function generateIndent(level: number, options: FormattingOptions) {
    if (options.insertSpaces) {
        return repeat(' ', level * options.tabSize);
    } else {
        return repeat('\t', level);
    }
}

export interface SemanticTokenData {
    start: Position;
    length: number;
    typeIdx: number;
    modifierSet: number;
}

export type CompletionItemData = {
    languageId: string;
    uri: string;
    offset: number;
};

export function isCompletionItemData(value: any): value is CompletionItemData {
    return (
        value &&
        typeof value.languageId === 'string' &&
        typeof value.uri === 'string' &&
        typeof value.offset === 'number'
    );
}

