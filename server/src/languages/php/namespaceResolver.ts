'use strict';

import { runSafe } from '../../helpers/general';

export class NamespaceResolver {
    psr4: Map<string, string> = new Map(); // namespace, path

    constructor(composerContent: string) {
        this.setPsr4(composerContent);
    }

    private setPsr4(composerContent: string) {
        runSafe(
            () => {
                const composerJson = JSON.parse(composerContent);
                const autoloadTypes = ['autoload', 'autoload-dev'];

                autoloadTypes.forEach((type) => {
                    const psr4 = (composerJson[type] || {})['psr-4'];
                    if (psr4) {
                        Object.keys(psr4).forEach((key) => {
                            this.psr4.set(key, psr4[key]);
                        });
                    }
                });
            },
            undefined,
            ''
        );
    }
}

