'use strict';

import {
    Block,
    Expression,
    ExpressionStatement,
    Function,
    Method,
    Node,
    Parameter,
    Return,
    Statement,
} from 'php-parser';
import { Analyzer, NodeVisitor } from '../../analyzer';
import { PhpSymbolKind } from '../../indexing/tables/symbolTable';
import { attrGroupsVisitor, createSymbol, modifier, parseFlag } from '../../../../helpers/analyze';

export class FunctionVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visitSymbol(fnNode: unknown): boolean {
        const node = fnNode as Function;

        const scope = this.analyzer.resetMember();
        this.analyzer.setMember(
            createSymbol(node.name, PhpSymbolKind.Function, node.loc, scope, modifier(), node.type)
        );

        return true;
    }

    visitReference(fnNode: unknown): boolean {
        // todo: type
        const node = fnNode as Function;
        attrGroupsVisitor(node.attrGroups, this.analyzer);
        return false;
    }
}

// class MethodVisitor {
//     constructor(private analyzer: Analyzer) {}

//     private visitVariableDeclaration(statement: VariableDeclaration): void {
//         statement.declarations.forEach((declaration) => {
//             const varSymbol = createSymbol(declaration.id.name, declaration.loc, this.analyzer.member.name);
//             this.analyzer.addSymbol(varSymbol);
//             if (declaration.init) {
//                 this.visitExpression(declaration.init);
//             }
//         });
//     }

//     private visitCallExpression(expression: CallExpression): void {
//         // Function call references
//         const reference = createReference(expression.callee.name, expression.loc);
//         this.analyzer.addReference(reference);

//         // Visit arguments
//         expression.arguments.forEach((arg) => this.visitExpression(arg));
//     }

//     private visitBinaryExpression(expression: BinaryExpression): void {
//         this.visitExpression(expression.left);
//         this.visitExpression(expression.right);
//     }

//     private visitMemberExpression(expression: MemberExpression): void {
//         this.visitExpression(expression.object);
//         const reference = createReference(expression.property.name, expression.loc);
//         this.analyzer.addReference(reference);
//     }
// }

