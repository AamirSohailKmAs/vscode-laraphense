export const QUEUE_CHUNK_SIZE: number = 10000;
export const INDEX_DELAY = 500;
export const DEFAULT_PHP_VERSION = 803;
export const DEFAULT_MAX_FILE_SIZE = 1024 * 1024; // 1MB
export const DEFAULT_MAX_OPEN_FILES = 10;
export const LARAPHENSE_VERSION = '0.1.0';
export const CONFIG_SECTION = 'laraphense';

export const DEFAULT_LARAPHENSE_CONFIG = {
    maxFileSize: DEFAULT_MAX_FILE_SIZE,
    phpVersion: DEFAULT_PHP_VERSION,
};

export const DEFAULT_INCLUDE = ['**'];
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

export const DEFAULT_STUBS = [
    'apache',
    'bcmath',
    'bz2',
    'calendar',
    'com_dotnet',
    'Core',
    'ctype',
    'curl',
    'date',
    'dba',
    'dom',
    'enchant',
    'exif',
    'fileinfo',
    'filter',
    'fpm',
    'ftp',
    'gd',
    'hash',
    'iconv',
    'imap',
    'intl',
    'json',
    'ldap',
    'libxml',
    'mbstring',
    'mcrypt',
    'mssql',
    'mysqli',
    'oci8',
    'odbc',
    'openssl',
    'pcntl',
    'pcre',
    'PDO',
    'pdo_ibm',
    'pdo_mysql',
    'pdo_pgsql',
    'pdo_sqlite',
    'pgsql',
    'Phar',
    'posix',
    'pspell',
    'random',
    'readline',
    'Reflection',
    'regex',
    'session',
    'shmop',
    'SimpleXML',
    'snmp',
    'soap',
    'sockets',
    'sodium',
    'SPL',
    'sqlite3',
    'standard',
    'superglobals',
    'sybase',
    'sysvmsg',
    'sysvsem',
    'sysvshm',
    'tidy',
    'tokenizer',
    'xml',
    'xmlreader',
    'xmlrpc',
    'xmlwriter',
    'Zend OPcache',
    'zip',
    'zlib',
];

