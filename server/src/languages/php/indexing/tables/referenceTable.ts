'use strict';

import { RelativeUri } from '../../../../support/workspaceFolder';
import { Definition } from '../../../../helpers/symbol';
import { PhpType } from '../../../../helpers/type';
import { PhpSymbolKind } from './symbolTable';

export type Reference<T> = Definition<T> & {
    symbolId: number;
};

export type PhpReference = Reference<PhpSymbolKind> & {
    isGlobal: boolean;
    type?: PhpType;
    alias?: string;
};

interface CacheData<Kind, T extends Definition<Kind>> {
    index: number;
    references: [number, T][];
    referencesByUri: { [uri: RelativeUri]: number[] };
    importsByUri: { [uri: RelativeUri]: number[] };
    pendingByFqn: { [fqn: string]: number[] };
}

export class ReferenceTable<Kind, T extends Reference<Kind>> {
    private index: number = 0;
    private references: Map<number, T> = new Map();
    private referencesByUri: Map<RelativeUri, number[]> = new Map();
    private importsByUri: Map<RelativeUri, number[]> = new Map();
    private pendingByFqn: Map<string, number[]> = new Map();

    public generateId(): number {
        return this.index++;
    }

    public addImports(uses: T[]) {
        for (let i = 0; i < uses.length; i++) {
            this.addImport(uses[i]);
        }
    }

    public addImport(use: T) {
        if (!this.isIdValidate(use)) return;

        this.references.set(use.id, use);

        if (use.symbolId === 0) {
            this.mustAddToMap(this.pendingByFqn, use.scope, use.id);
        }

        this.mustAddToMap(this.importsByUri, use.uri, use.id);
    }

    public addReference(reference: T) {
        if (!this.isIdValidate(reference)) return;

        this.references.set(reference.id, reference);

        if (reference.symbolId === 0) {
            this.mustAddToMap(this.pendingByFqn, reference.scope, reference.id);
        }

        this.mustAddToMap(this.referencesByUri, reference.uri, reference.id);
    }

    public getReferenceByIds(referenceIds: number[]) {
        return referenceIds.map((index) => this.references.get(index)!).filter((reference) => reference);
    }

    public getReferenceById(referenceId: number) {
        return this.references.get(referenceId);
    }

    public findReferenceByOffsetInUri(uri: RelativeUri, offset: number): T | undefined {
        const references = this.findReferencesByUri(uri);

        for (const reference of references) {
            if (reference && reference.loc.start.offset <= offset && reference.loc.end.offset >= offset) {
                return reference;
            }
        }
        return undefined;
    }

    public findReferencesByUri(uri: RelativeUri): T[] {
        return this.getReferenceByIds(this.getReferenceIndicesByUri(uri));
    }

    findPendingByFqn(fqn: string) {
        const refs = this.pendingByFqn.get(fqn) || [];
        this.pendingByFqn.delete(fqn);
        return this.getReferenceByIds(refs);
    }

    public findImportsByUri(uri: RelativeUri) {
        const indices = this.importsByUri.get(uri) || [];
        return this.getReferenceByIds(indices);
    }

    private getReferenceIndicesByUri(uri: RelativeUri) {
        const imports = this.importsByUri.get(uri) || [];
        const refs = this.referencesByUri.get(uri) || [];

        return imports.concat(refs);
    }

    public updateReference(index: number, newReference: T) {
        const oldReference = this.getReferenceById(index);
        if (!oldReference) {
            return;
        }

        this.references.set(index, newReference);
    }

    public deleteReference(index: number) {
        const reference = this.getReferenceById(index);
        if (!reference) {
            return;
        }

        this.references.delete(index);

        // Update URI index
        const uriIndices = this.getReferenceIndicesByUri(reference.uri)!;
        const uriIndexPos = uriIndices.indexOf(index);
        if (uriIndexPos > -1) {
            uriIndices.splice(uriIndexPos, 1);
        }
    }

    public deleteReferencesByUri(uri: RelativeUri) {
        const references = this.findReferencesByUri(uri);

        for (const ref of references) {
            this.references.delete(ref.id);
        }

        this.importsByUri.delete(uri);
        this.referencesByUri.delete(uri);
    }

    public saveForFile(): CacheData<Kind, T> {
        return {
            index: this.index,
            references: Array.from(this.references.entries()),
            referencesByUri: Object.fromEntries(this.referencesByUri),
            importsByUri: Object.fromEntries(this.importsByUri),
            pendingByFqn: Object.fromEntries(this.pendingByFqn),
        };
    }

    public loadFromFile(data: any): boolean {
        if (!this.validateCacheData(data)) {
            return false;
        }

        this.index = data.index;
        this.references = new Map(data.references);
        this.referencesByUri = new Map(
            Object.entries(data.referencesByUri).map(([key, value]) => [key as RelativeUri, value as number[]])
        );
        this.importsByUri = new Map(
            Object.entries(data.importsByUri).map(([key, value]) => [key as RelativeUri, value as number[]])
        );
        this.pendingByFqn = new Map(Object.entries(data.pendingByFqn));

        return true;
    }

    private isIdValidate(ref: T) {
        if (ref.id === 0) {
            ref.id = this.generateId();
            return true;
        }

        if (this.references.has(ref.id)) {
            console.log(ref, ' already exists');

            return false;
        }
    }

    private mustAddToMap<T>(map: Map<T, number[]>, key: T, index: number) {
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key)!.push(index);
    }

    private validateCacheData(data: CacheData<Kind, T>): boolean {
        // Validate the structure and types of CacheData
        if (
            typeof data.index !== 'number' ||
            typeof data.references !== 'object' ||
            typeof data.referencesByUri !== 'object' ||
            typeof data.importsByUri !== 'object' ||
            typeof data.pendingByFqn !== 'object'
        ) {
            return false;
        }
        if (
            !Array.isArray(data.references) ||
            Array.isArray(data.referencesByUri) ||
            Array.isArray(data.importsByUri) ||
            Array.isArray(data.pendingByFqn)
        ) {
            return false;
        }
        if (
            !data.references.every(
                (item: any) =>
                    Array.isArray(item) &&
                    item.length === 2 &&
                    typeof item[0] === 'number' &&
                    typeof item[1] === 'object'
            )
        ) {
            return false;
        }

        if (
            !Object.entries(data.referencesByUri).every(
                (item: any) => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string'
            )
        ) {
            return false;
        }

        if (
            !Object.entries(data.importsByUri).every(
                (item: any) => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string'
            )
        ) {
            return false;
        }
        if (
            !Object.entries(data.pendingByFqn).every(
                (item: any) => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string'
            )
        ) {
            return false;
        }
        return true;
    }
}

