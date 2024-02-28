import { CompletionList } from 'vscode-languageserver';

export const EMPTY_COMPLETION_LIST: CompletionList = CompletionList.create();
export const QUEUE_CHUNK_SIZE: number = 10000;
export const INDEX_DELAY = 500;
export const DEFAULT_PHP_VERSION = 803;
export const DEFAULT_MAX_FILE_SIZE = 1024 * 1024;
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

