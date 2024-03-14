'use strict';

import { DocumentUri } from 'vscode-languageserver-textdocument';

/**
 * A tagging type for string properties that are actually part of uri after folder URI.
 */
export type RelativeUri = string;

/**
 * A tagging type for string properties that are actually Folder URI.
 */
export type FolderUri = string;

/**
 * Pri Stands For Project Resource Identifier
 */
export type Pri = { folder: FolderUri; sub: RelativeUri; uri: DocumentUri };

