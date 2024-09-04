'use strict';

import { Location } from '../ast';

export interface EnvNode {
    kind: 'keyValue';
    key: string;
    value: string;
    loc: Location;
}

export interface EnvAST {
    kind: 'envFile' | 'errorNode';
    children?: EnvNode[];
    loc: Location;
}

