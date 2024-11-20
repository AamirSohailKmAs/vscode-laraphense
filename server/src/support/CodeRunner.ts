'use strict';

import { exec } from 'child_process';

export class PhpRunner {
    constructor(private _phpCommand: string = 'php -r "{code}"') {}

    public command(code: string): string {
        return this._phpCommand.substring(0).replace('{code}', code);
    }

    public async run(code: string): Promise<string> {
        return new Promise<string>((resolve, error) => {
            exec(this.command(code), function (_err, stdout, stderr) {
                if (stdout.length > 0) {
                    resolve(stdout);
                } else {
                    error(stderr);
                }
            });
        });
    }
}

