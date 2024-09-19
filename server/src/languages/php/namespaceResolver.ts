'use strict';

import { Resolution, getResolution } from '../../helpers/analyze';
import { runSafe } from '../../helpers/general';
import { joinNamespace } from '../../helpers/symbol';
import { PhpReference } from './indexing/tables/referenceTable';
import { PhpSymbolKind } from './indexing/tables/symbolTable';

export class NamespaceResolver {
    private _psr4: Map<string, string> = new Map(); // namespace, path

    private _imports: PhpReference[] = [];
    private _funcImports: PhpReference[] = [];
    private _constImports: PhpReference[] = [];

    constructor(composerContent: string) {
        this._setPsr4(composerContent);
    }

    public clearImports() {
        this._imports = [];
        this._constImports = [];
        this._funcImports = [];
    }

    public addImport(use: PhpReference) {
        if (use.kind === PhpSymbolKind.Function) {
            this._funcImports.push(use);
        } else if (use.kind === PhpSymbolKind.Constant) {
            this._constImports.push(use);
        } else {
            this._imports.push(use);
        }
    }

    public resolveFromImport(ref: PhpReference): string {
        if (!ref.name) {
            return '';
        }

        // @todo php reserve name

        const resolution = getResolution(ref.name);

        switch (resolution) {
            case Resolution.FullyQualified:
                return ref.name.slice(1);
            case Resolution.Qualified:
                return this.resolveQualified(ref);
            default:
                return this.resolveUnqualified(ref);
        }
    }

    private getImports(kind: PhpSymbolKind): PhpReference[] {
        if (kind === PhpSymbolKind.Function) {
            return this._funcImports;
        }
        if (kind === PhpSymbolKind.Constant) {
            return this._constImports;
        }
        return this._imports;
    }

    private _setPsr4(composerContent: string) {
        runSafe(
            () => {
                const composerJson = JSON.parse(composerContent);
                const autoloadTypes = ['autoload', 'autoload-dev'];

                autoloadTypes.forEach((type) => {
                    const psr4 = (composerJson[type] || {})['psr-4'];
                    if (psr4) {
                        Object.keys(psr4).forEach((key) => {
                            this._psr4.set(key, psr4[key]);
                        });
                    }
                });
            },
            undefined,
            ''
        );
    }

    private resolveQualified(ref: PhpReference) {
        const relative = ref.name.substring(0, ref.name.indexOf('\\'));
        const use = this.getImports(ref.kind).find((use) => use.name.endsWith(relative));

        if (!use) return ref.scope;

        return joinNamespace(use.scope, ref.name.substring(ref.name.indexOf('\\')));
    }

    private resolveUnqualified(ref: PhpReference) {
        const use = this.getImports(ref.kind).find((use) => use.alias === ref.name || use.name.endsWith(ref.name));
        if (!use) return ref.scope;

        return use.scope;
    }

}

