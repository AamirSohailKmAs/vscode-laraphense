'use strict';

import { RelativeUri } from '../../../../support/workspaceFolder';
import * as fs from 'fs';
import { Symbol } from './symbolTable';
import { FQN } from '../../../../helpers/symbol';
import { PhpType } from '../../../../helpers/type';

export type PhpReference = Symbol & {
    fqn: FQN;
    definedIn: FQN;
    symbolId: number;
    type?: PhpType;
};

export type ImportStatement = PhpReference & {
    alias: string;
};

interface CacheData {
    references: [number, PhpReference][];
    uriIndex: { [uri: string]: number[] };
}

export class ReferenceTable {
    private index: number = 0;
    private references: Map<number, PhpReference> = new Map();
    private referencesByUri: Map<RelativeUri, number[]> = new Map();
    private importsByUri: Map<RelativeUri, number[]> = new Map();
    public pendingReferences: PhpReference[] = [];

    public generateId(): number {
        return this.index++;
    }

    public addReferences(references: PhpReference[]) {
        for (let i = 0; i < references.length; i++) {
            this.addReference(references[i]);
        }
    }

    public addImports(references: ImportStatement[]) {
        for (let i = 0; i < references.length; i++) {
            const ref = this.addReference(references[i]);

            if (!this.importsByUri.has(ref.uri)) {
                this.importsByUri.set(ref.uri, []);
            }
            this.importsByUri.get(ref.uri)!.push(ref.id);
        }
    }

    public addReference(reference: PhpReference) {
        if (reference.id === 0) {
            reference.id = this.generateId();
        }

        if (this.references.has(reference.id)) {
            console.log(reference, ' already exists');

            return reference;
        }

        if (reference.symbolId === 0) {
            this.pendingReferences.push(reference);
            return reference;
        }
        // let key = toFqsen(symbol.kind, symbol.name, symbol.scope);
        // const oldSymbol = this._symbolMap.get(key);

        const index = reference.id;
        this.references.set(index, reference);

        if (!this.referencesByUri.has(reference.uri)) {
            this.referencesByUri.set(reference.uri, []);
        }
        this.referencesByUri.get(reference.uri)!.push(index);

        return reference;
    }

    public getReferenceByIds(referenceIds: number[]) {
        const references: PhpReference[] = [];

        for (let i = 0; i < referenceIds.length; i++) {
            const ref = this.references.get(referenceIds[i]);
            if (ref) {
                references.push(ref);
            }
        }

        return references;
    }

    public getReferenceById(referenceId: number) {
        return this.references.get(referenceId);
    }

    public findReferenceByOffsetInUri(uri: RelativeUri, offset: number): PhpReference | undefined {
        const indices = this.referencesByUri.get(uri) || [];

        for (const index of indices) {
            const reference = this.references.get(index);
            if (reference && reference.loc.start.offset <= offset && reference.loc.end.offset >= offset) {
                return reference;
            }
        }
        return undefined;
    }

    public findReferencesByUri(uri: RelativeUri): PhpReference[] {
        const indices = this.referencesByUri.get(uri) || [];
        return indices.map((index) => this.references.get(index)!).filter((reference) => reference);
    }

    public updateReference(index: number, newReference: PhpReference) {
        const oldReference = this.references.get(index);
        if (oldReference) {
            this.references.set(index, newReference);

            // Update URI index
            const uriIndices = this.referencesByUri.get(oldReference.uri)!;
            const uriIndexPos = uriIndices.indexOf(index);
            if (uriIndexPos > -1) {
                uriIndices[uriIndexPos] = index;
            }
        }
    }

    public deleteReference(index: number) {
        const reference = this.references.get(index);
        if (reference) {
            this.references.delete(index);

            // Update URI index
            const uriIndices = this.referencesByUri.get(reference.uri)!;
            const uriIndexPos = uriIndices.indexOf(index);
            if (uriIndexPos > -1) {
                uriIndices.splice(uriIndexPos, 1);
            }
        }
    }

    public deleteReferencesByUri(uri: RelativeUri) {
        const indices = this.referencesByUri.get(uri) || [];
        for (const index of indices) {
            const reference = this.references.get(index);
            if (reference) {
                this.references.delete(index);
            }
        }

        this.referencesByUri.delete(uri);
    }

    public saveForFile(): CacheData {
        return {
            references: Array.from(this.references.entries()),
            uriIndex: Object.fromEntries(this.referencesByUri),
        };
    }

    // public loadFromFile(filePath: string) {
    //     const data: CacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    //     this.references = new Map(data.references);
    //     this.referencesByUri = new Map(Object.entries(data.uriIndex));
    // }
}

