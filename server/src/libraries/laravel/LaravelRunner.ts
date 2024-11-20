'use strict';

import { PhpRunner } from '../../support/CodeRunner';
import { existsSync } from 'fs-extra';

export class LaravelRunner {
    constructor(private runner: PhpRunner, private autoloadFilePath: string, private appFilePath: string) {}

    public async run(code: string): Promise<string> {
        if (!existsSync(this.autoloadFilePath) || !existsSync(this.appFilePath)) {
            return Promise.resolve('');
        }

        return new Promise((resolve, reject) => {
            this.runner
                .run(this.artisan(code))
                .then((result: string) => {
                    const match = /___VSCODE_LARAPHENSE_START___(.*)___VSCODE_LARAPHENSE_END___/s.exec(result);

                    if (!match) {
                        reject(`PARSE ERROR: ${result}`);
                        return;
                    }

                    resolve(match[1]);
                })
                .catch((e: Error) => {
                    reject(e);
                });
        });
    }

    private artisan(code: string): string {
        return `
            define('LARAVEL_START', microtime(true));
            require_once '${this.autoloadFilePath}';
            $app = require_once '${this.appFilePath}';
            $kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
            $status = $kernel->handle(
                $input = new Symfony\\Component\\Console\\Input\\ArgvInput,
                new Symfony\\Component\\Console\\Output\\ConsoleOutput
            );
            echo '___VSCODE_LARAPHENSE_START___';
            ${code.replace(/(?:\r\n|\r|\n)/g, ' ')}
            echo '___VSCODE_LARAPHENSE_END___';
        `;
    }
}

