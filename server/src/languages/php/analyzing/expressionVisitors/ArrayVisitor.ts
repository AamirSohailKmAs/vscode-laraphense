'use strict';

import { Array, Entry, Expression, Node, Variable } from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';

type ArrayEntry = {
    key: string | number | null; // Key can be a string, number, or null for indexed arrays
    value: any; // The value of the entry, could be a literal or another array
    //     location: Location; // Location of the key-value pair or indexed value
    //     valueType: PhpType; // The type of the value, used for type inference
};

export class ArrayVisitor implements NodeVisitor {
    private arrayEntries: ArrayEntry[] = [];
    constructor(private analyzer: Analyzer) {}

    visitSymbol(node: Array): boolean {
        return false;
    }

    visitReference(node: Array): boolean {
        node.items.forEach((item) => this.visitArrayItem(item));
        return false;
    }

    // Method to visit an array item (key-value pair or indexed value)
    private visitArrayItem(item: Expression | Entry): void {
        if (item.kind !== 'entry') {
            console.log(item);
            return;
        }

        //   const entry: ArrayEntry = {
        //       key: this.getArrayItemKey(item),
        //       value: this.getArrayItemValue(item),
        //       location: this.getArrayItemLocation(item),
        //       valueType: this.inferValueType(item.value),
        //   };

        //   this.arrayEntries.push(entry);

        //   // Recursively visit if the value itself is an array
        //   if (item.value && item.value.kind === 'array') {
        //       this.visitArray(item.value);
        //   }
    }

    // Helper to extract the key of an array item
    private getArrayItemKey(item: Node | null): string | number | null {
        if (item) {
            // if (item.kind === 'string' || item.kind === 'number') {
            //     return item.key.value; // Return key as string or number
            // }
        }
        return null; // Return null if it's an indexed array
    }

    // Helper to extract the value of an array item
    //     private getArrayItemValue(item: any): any {
    //         return item.value; // Return the value directly
    //     }

    // Helper to extract the location of an array item
    //     private getArrayItemLocation(item: any): Location {
    //         return {
    //             start: {
    //                 line: item.loc.start.line,
    //                 character: item.loc.start.column,
    //                 offset: item.loc.start.offset,
    //             },
    //             end: {
    //                 line: item.loc.end.line,
    //                 character: item.loc.end.column,
    //                 offset: item.loc.end.offset,
    //             },
    //         };
    //     }

    // Helper to infer the type of the value for type checking and validation
    //     private inferValueType(value: any): PhpType {
    //         switch (value.kind) {
    //             case 'number':
    //                 return { name: 'number', items: [] };
    //             case 'string':
    //                 return { name: 'string', items: [] };
    //             case 'boolean':
    //                 return { name: 'boolean', items: [] };
    //             case 'array':
    //                 return { name: 'array', items: [] };
    //             default:
    //                 return { name: 'mixed', items: [] }; // Default to 'mixed' if the type cannot be determined
    //         }
    //     }

    // Method to get all collected array entries
    //     getArrayEntries(): ArrayEntry[] {
    //         return this.arrayEntries;
    //     }
}

