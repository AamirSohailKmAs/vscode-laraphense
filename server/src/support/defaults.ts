import { CompletionList } from 'vscode-languageserver';

export const EMPTY_COMPLETION_LIST: CompletionList = CompletionList.create();
export const QUEUE_CHUNK_SIZE: number = 10000;
export const INDEX_DELAY = 500;
export const DEFAULT_MAX_FILE_SIZE = 1000000;
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
