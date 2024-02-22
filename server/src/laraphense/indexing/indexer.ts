'use strict';

import { Queue } from '../../support/queue';
import { Workspace } from './workspace';

enum QueueAction {
    Index,
    Forget,
}

export class Indexer {
    private queue: Queue<{ uri: string; action: QueueAction }>;
    private _isIndexing: boolean = false;
    constructor(private _workspace: Workspace, private _maxFileSize: number) {
        this.queue = new Queue();
    }

    get maxFileSize() {
        return this._maxFileSize;
    }

    set maxFileSize(size: number) {
        this._maxFileSize = size;
    }

    public indexWorkspace(openUris: string[]) {
        console.log('openUris', openUris);

        // this._workspace.folders.forEach(this.indexFolder.bind(this));
    }

    }

