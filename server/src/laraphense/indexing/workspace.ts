'use strict';

import { WorkspaceFolder } from './workspaceFolder';

export class Workspace {
    private _folders: WorkspaceFolder[];

    constructor(folders: WorkspaceFolder[]) {
        this._folders = folders;
    }

    public get folders(): WorkspaceFolder[] {
        return this._folders;
    }

    public addFolder(folder: WorkspaceFolder) {
        this._folders.push(folder);
    }
}

