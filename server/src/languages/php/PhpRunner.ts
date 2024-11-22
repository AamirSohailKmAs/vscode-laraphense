'use strict';

import { exec } from 'child_process';
import { platform } from 'os';

export class PhpRunner {
    constructor(private _phpCommand: string = 'php -r "{code}"') {}

    public command(code: string): string {
        code = code.replace(/"/g, '\\"');

        if (['darwin', 'linux', 'openbsd', 'sunos'].some((unixPlatform) => platform().includes(unixPlatform))) {
            code = code.replace(/\$/g, '\\$').replace(/\\\\'/g, "\\\\\\\\'").replace(/\\"/g, '\\\\\\\\"');
        }

        return this._phpCommand.replace('{code}', code);
    }

    public async run(code: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            exec(this.command(code), (err, stdout, stderr) => {
                if (stdout) {
                    resolve(stdout);
                } else {
                    reject(stderr || err?.message);
                }
            });
        });
    }
}

