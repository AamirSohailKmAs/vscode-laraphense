'use strict';

import { RelativeUri } from '../../../../support/workspaceFolder';
import { PhpSymbolKind } from './symbolTable';
import { Symbol } from '../../../../helpers/symbol';
import { PhpType } from '../../../../helpers/type';

export type PhpReference = Symbol & {
    kind: PhpSymbolKind;
    fqn: string;
    isGlobal: boolean;
    symbolId: number;
    type?: PhpType;
    alias?: string;
};

interface CacheData {
    index: number;
    references: [number, PhpReference][];
    referencesByUri: { [uri: string]: number[] };
    importsByUri: { [uri: string]: number[] };
    pendingByFqn: { [fqn: string]: number[] };
}

export class ReferenceTable {
    private index: number = 0;
    private references: Map<number, PhpReference> = new Map();
    private referencesByUri: Map<RelativeUri, number[]> = new Map();
    private importsByUri: Map<RelativeUri, number[]> = new Map();
    private pendingByFqn: Map<string, number[]> = new Map();

    public generateId(): number {
        return this.index++;
    }

    public addImports(uses: PhpReference[]) {
        for (let i = 0; i < uses.length; i++) {
            this.addImport(uses[i]);
        }
    }

    public addImport(use: PhpReference) {
        if (!this.isIdValidate(use)) return;

        this.references.set(use.id, use);

        if (use.symbolId === 0) {
            this.mustAddToMap(this.pendingByFqn, use.fqn, use.id);
        }

        this.mustAddToMap(this.importsByUri, use.uri, use.id);
    }

    public addReference(reference: PhpReference) {
        if (!this.isIdValidate(reference)) return;

        this.references.set(reference.id, reference);

        if (reference.symbolId === 0) {
            this.mustAddToMap(this.pendingByFqn, reference.fqn, reference.id);
        }

        this.mustAddToMap(this.referencesByUri, reference.uri, reference.id);
    }

    public getReferenceByIds(referenceIds: number[]) {
        return referenceIds.map((index) => this.references.get(index)!).filter((reference) => reference);
    }

    public getReferenceById(referenceId: number) {
        return this.references.get(referenceId);
    }

    public findReferenceByOffsetInUri(uri: RelativeUri, offset: number): PhpReference | undefined {
        const references = this.findReferencesByUri(uri);

        for (const reference of references) {
            if (reference && reference.loc.start.offset <= offset && reference.loc.end.offset >= offset) {
                return reference;
            }
        }
        return undefined;
    }

    public findReferencesByUri(uri: RelativeUri): PhpReference[] {
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

    public updateReference(index: number, newReference: PhpReference) {
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

    public saveForFile(): CacheData {
        return {
            index: this.index,
            references: Array.from(this.references.entries()),
            referencesByUri: Object.fromEntries(this.referencesByUri),
            importsByUri: Object.fromEntries(this.importsByUri),
            pendingByFqn: Object.fromEntries(this.pendingByFqn),
        };
    }

    public loadFromFile(cacheFileContent: string) {
        const data: CacheData = JSON.parse(cacheFileContent);
        this.references = new Map(data.references);
    }

    private isIdValidate(ref: PhpReference) {
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
}

