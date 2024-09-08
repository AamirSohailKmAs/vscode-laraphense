'use strict';

export type PhpType = {
    name: string;
    items: PhpType[];
};

export function createType(name: string, items: PhpType[] = []): PhpType {
    return { name, items };
}

export const NULL_NAME = 'null';
export const BOOLEAN_NAME = 'bool';
export const UNION_NAME_SYMBOL = '|';
export const INTERSECTION_NAME_SYMBOL = '&';
export const STRING_NAME = 'string';
export const INT_NAME = 'int';
export const VOID_NAME = 'void';
export const FLOAT_NAME = 'float';
export const MIXED_NAME = 'mixed';
export const STATIC_NAME = 'static';
export const SELF_NAME = 'self';
export const ARRAY_NAME = 'array';
export const ARRAY_NAME_SYMBOL = '[]';
export const ARRAY_KEY_NAME = 'array-key';
export const OBJECT_NAME = 'object';
export const CALLABLE_NAME = 'callable';
export const CLOSURE_NAME = 'Closure';
export const ITERABLE_NAME = 'iterable';
export const GENERATOR_NAME = 'Generator';
export const THIS_NAME = '$this';
export const RESOURCE_NAME = 'resource';
export const COUNTABLE_NAME = 'Countable';
export const UNSET_NAME = 'unset';
export const TRUE_NAME = 'true';
export const FALSE_NAME = 'false';
export const NEVER_NAME = 'never';
export const ARRAY_ACCESS_NAME = 'ArrayAccess';
export const TRAVERSABLE_NAME = 'Traversable';

const builtInTypes = new Set([
    'self',
    'static',
    'parent',

    'object',
    'callable',

    'array',
    'iterable',

    'float',
    'int',
    'string',

    'never',
    'void',
    'mixed',

    'null',

    'bool',
    'false',
    'true',
]);

const softReservedNames = new Set(['resource', 'numeric', 'enum']);

const keywords = new Set([
    '$this',
    'self',
    'static',

    'array',
    'iterable',
    'array-key',

    'string',
    'class-string',

    'bool',
    'false',
    'true',

    'callable',

    'int',
    'float',

    'null',

    'object',
    'resource',

    'mixed',
    'never',
    'void',
    'unset',
]);

export function isKeyword(name: string) {
    return keywords.has(name.toLowerCase());
}

export function isUnion(type: PhpType) {
    return type.name === UNION_NAME_SYMBOL;
}
export function isIntersection(type: PhpType) {
    return type.name === INTERSECTION_NAME_SYMBOL;
}

export function isAtomic(type: PhpType): boolean {
    return type.name !== UNION_NAME_SYMBOL && type.name !== INTERSECTION_NAME_SYMBOL;
}


