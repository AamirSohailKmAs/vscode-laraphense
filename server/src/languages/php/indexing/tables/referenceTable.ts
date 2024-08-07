'use strict';

import { RelativeUri } from '../../../../support/workspaceFolder';
import * as fs from 'fs';
import { Symbol } from './symbolTable';
import { BinarySearchTree } from '../../../../support/searchTree';

export type PhpReference = Symbol & {
    symbolId: number;
};

interface CacheData {
    references: [number, PhpReference][];
    uriIndex: { [uri: string]: number[] };
}

export class ReferenceTable {
    private references: Map<number, PhpReference> = new Map();
    private referencesByUri: Map<string, number[]> = new Map();
    private uriTrees: Map<string, BinarySearchTree<PhpReference>> = new Map();
    private index: number = 0;

    public addReferences(references: PhpReference[], uri: RelativeUri) {
        for (let i = 0; i < references.length; i++) {
            const reference = references[i];
            reference.uri = uri;
            this.addReference(reference);
        }
    }

    public addReference(reference: PhpReference) {
        const index = this.index++;
        this.references.set(index, reference);

        if (!this.referencesByUri.has(reference.uri)) {
            this.referencesByUri.set(reference.uri, []);
            this.uriTrees.set(reference.uri, new BinarySearchTree());
        }
        this.referencesByUri.get(reference.uri)!.push(index);
        this.uriTrees.get(reference.uri)!.insert(reference.loc.start.offset, reference);
    }

    public findReferenceByOffsetInUri(uri: string, offset: number): PhpReference | undefined {
        const tree = this.uriTrees.get(uri);
        if (!tree) {
            return undefined;
        }
        const references = tree.between({ gte: offset, lte: offset });
        return references.length > 0 ? references[0] : undefined;
    }

    public findReferencesByUri(uri: string): PhpReference[] {
        const indices = this.referencesByUri.get(uri) || [];
        return indices.map((index) => this.references.get(index)!).filter((reference) => reference);
    }

    public updateReference(index: number, newReference: PhpReference) {
        const oldReference = this.references.get(index);
        if (oldReference) {
            this.references.set(index, newReference);

            // Update URI index and Tree
            const uriIndices = this.referencesByUri.get(oldReference.uri)!;
            uriIndices[uriIndices.indexOf(index)] = index;
            const tree = this.uriTrees.get(oldReference.uri)!;
            tree.delete(oldReference.loc.start.offset);
            tree.insert(newReference.loc.start.offset, newReference);
        }
    }

    public deleteReference(index: number) {
        const reference = this.references.get(index);
        if (reference) {
            this.references.delete(index);

            // Update URI index and Tree
            const uriIndices = this.referencesByUri.get(reference.uri)!;
            const uriIndexPos = uriIndices.indexOf(index);
            if (uriIndexPos > -1) {
                uriIndices.splice(uriIndexPos, 1);
            }
            const tree = this.uriTrees.get(reference.uri)!;
            tree.delete(reference.loc.start.offset);
        }
    }

    public deleteReferencesByUri(uri: string) {
        const indices = this.referencesByUri.get(uri) || [];
        for (const index of indices) {
            const reference = this.references.get(index);
            if (reference) {
                this.references.delete(index);

                // Update URI Tree
                const tree = this.uriTrees.get(uri)!;
                tree.delete(reference.loc.start.offset);
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

    public loadFromFile(filePath: string) {
        const data: CacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.references = new Map(data.references);
        this.referencesByUri = new Map(Object.entries(data.uriIndex));

        // Reconstruct binary search trees
        this.uriTrees = new Map();
        for (const [_index, reference] of this.references) {
            if (!this.uriTrees.has(reference.uri)) {
                this.uriTrees.set(reference.uri, new BinarySearchTree());
            }
            this.uriTrees.get(reference.uri)!.insert(reference.loc.start.offset, reference);
        }
    }
}

