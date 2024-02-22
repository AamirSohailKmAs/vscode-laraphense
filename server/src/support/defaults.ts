import { CompletionList } from 'vscode-languageserver';

export const EMPTY_COMPLETION_LIST: CompletionList = CompletionList.create();
export const DEFAULT_EXCLUDE = [
    '**/.git/**',
    '**/.svn/**',
    '**/.hg/**',
    '**/CVS/**',
    '**/.DS_Store/**',
    '**/node_modules/**',
    '**/bower_components/**',
    '**/vendor/**/{Tests,tests}/**',
    '**/.history/**',
    '**/vendor/**/vendor/**',
];
