'use strict';

export class BinarySearch {
    constructor(protected _sortedArray: Array<number>) {}

    set sortedArray(sortedArray: Array<number>) {
        this._sortedArray = sortedArray;
    }

    find(matchFn: (midPoint: number) => number) {
        let result = this.search(matchFn);
        if (result.isExactMatch) {
            return this._sortedArray[result.rank];
        } else {
            return null;
        }
    }

    rank(matchFn: (midPoint: number) => number) {
        return this.search(matchFn).rank;
    }

    range(matchFn: (midPoint: number) => number, matchToFn: (midPoint: number) => number) {
        let rank = this.rank(matchFn);
        return this._sortedArray.slice(rank, this.search(matchToFn, rank).rank);
    }

    search(matchFn: (midPoint: number) => number, defaultRank?: number) {
        let result: {
            rank: number;
            isExactMatch: boolean;
        };
        let rank = defaultRank || 0;
        let length = this._sortedArray.length - 1;
        let mid = 0;
        let key = 0;
        for (;;) {
            if (rank > length) {
                result = {
                    rank: rank,
                    isExactMatch: false,
                };
                break;
            }
            mid = Math.floor((rank + length) / 2);
            key = matchFn(this._sortedArray[mid]);
            if (key < 0) {
                rank = mid + 1;
            } else {
                if (!(key > 0)) {
                    result = {
                        rank: mid,
                        isExactMatch: true,
                    };
                    break;
                }
                length = mid - 1;
            }
        }
        return result;
    }
}

export class TrieNode {
    children: Map<string, TrieNode> = new Map();
    indices: Set<number> = new Set();
}

export class Trie {
    root: TrieNode = new TrieNode();

    insert(name: string, index: number) {
        const words = splitWordByCasing(name);
        for (const word of words) {
            let node = this.root;
            for (const char of word.toLowerCase()) {
                if (!node.children.has(char)) {
                    node.children.set(char, new TrieNode());
                }
                node = node.children.get(char)!;
            }
            node.indices.add(index);
        }
    }

    remove(name: string, index: number) {
        const words = splitWordByCasing(name);
        for (const word of words) {
            const removeRecursive = (node: TrieNode, words: string, depth: number): boolean => {
                if (depth === words.length) {
                    node.indices.delete(index);
                    return node.indices.size === 0 && node.children.size === 0;
                }

                const char = words[depth].toLowerCase();
                if (!node.children.has(char)) {
                    return false;
                }

                const childNode = node.children.get(char)!;
                const shouldDeleteChild = removeRecursive(childNode, words, depth + 1);

                if (shouldDeleteChild) {
                    node.children.delete(char);
                }

                return node.indices.size === 0 && node.children.size === 0;
            };

            removeRecursive(this.root, word, 0);
        }
    }

    search(prefix: string): number[] {
        const words = splitWordByCasing(prefix);
        let resultIndices: number[] = [];

        for (const word of words) {
            let node = this.root;
            for (const char of word.toLowerCase()) {
                if (!node.children.has(char)) {
                    return [];
                }
                node = node.children.get(char)!;
            }

            const indicesForThisWord = this.collectAllIndices(node);

            if (resultIndices.length === 0) {
                resultIndices = indicesForThisWord;
            } else {
                resultIndices = resultIndices.filter((idx) => indicesForThisWord.includes(idx));
            }
        }

        return resultIndices;
    }

    private collectAllIndices(node: TrieNode): number[] {
        let result: number[] = Array.from(node.indices);
        for (const child of node.children.values()) {
            result = result.concat(this.collectAllIndices(child));
        }
        return result;
    }
}

function splitWordByCasing(word: string): string[] {
    return word.split(/(?=[A-Z])|[_-]/).filter(Boolean);
}

export class BinarySearchTreeNode<T> {
    public left: BinarySearchTreeNode<T> | null = null;
    public right: BinarySearchTreeNode<T> | null = null;

    constructor(public key: number, public value: T) {}
}

export class BinarySearchTree<T> {
    private root: BinarySearchTreeNode<T> | null = null;

    insert(key: number, value: T) {
        const newNode = new BinarySearchTreeNode(key, value);
        if (this.root === null) {
            this.root = newNode;
        } else {
            this.insertNode(this.root, newNode);
        }
    }

    delete(key: number): void {
        this.root = this.deleteNode(this.root, key);
    }

    find(key: number): T | null {
        let node = this.root;
        while (node !== null) {
            if (key < node.key) {
                node = node.left;
            } else if (key > node.key) {
                node = node.right;
            } else {
                return node.value;
            }
        }
        return null;
    }

    between(range: { gte: number; lte: number }): T[] {
        const result: T[] = [];
        this.inOrderTraverse((node) => {
            if (node.key >= range.gte && node.key <= range.lte) {
                result.push(node.value);
            }
        });
        return result;
    }

    private insertNode(node: BinarySearchTreeNode<T>, newNode: BinarySearchTreeNode<T>) {
        if (newNode.key < node.key) {
            if (node.left === null) {
                node.left = newNode;
            } else {
                this.insertNode(node.left, newNode);
            }
        } else {
            if (node.right === null) {
                node.right = newNode;
            } else {
                this.insertNode(node.right, newNode);
            }
        }
    }

    private deleteNode(node: BinarySearchTreeNode<T> | null, key: number): BinarySearchTreeNode<T> | null {
        if (node === null) {
            return null;
        }

        if (key < node.key) {
            node.left = this.deleteNode(node.left, key);
            return node;
        } else if (key > node.key) {
            node.right = this.deleteNode(node.right, key);
            return node;
        } else {
            if (node.left === null && node.right === null) {
                return null;
            }

            if (node.left === null) {
                return node.right;
            } else if (node.right === null) {
                return node.left;
            }

            const minRight = this.findMinNode(node.right);
            node.key = minRight.key;
            node.value = minRight.value;
            node.right = this.deleteNode(node.right, minRight.key);
            return node;
        }
    }

    private findMinNode(node: BinarySearchTreeNode<T>): BinarySearchTreeNode<T> {
        while (node.left !== null) {
            node = node.left;
        }
        return node;
    }

    private inOrderTraverse(callback: (node: BinarySearchTreeNode<T>) => void) {
        this.inOrderTraverseNode(this.root, callback);
    }

    private inOrderTraverseNode(
        node: BinarySearchTreeNode<T> | null,
        callback: (node: BinarySearchTreeNode<T>) => void
    ) {
        if (node !== null) {
            this.inOrderTraverseNode(node.left, callback);
            callback(node);
            this.inOrderTraverseNode(node.right, callback);
        }
    }
}

