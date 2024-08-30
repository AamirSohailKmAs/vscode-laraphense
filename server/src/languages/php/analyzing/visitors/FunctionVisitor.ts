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
import { PhpSymbol, SymbolKind } from '../../indexing/tables/symbolTable';
import { createReference, createSymbol, modifier, normalizeName, parseFlag } from '../../../../helpers/analyze';
import { PhpReference } from '../../indexing/tables/referenceTable';

export class FunctionVisitor implements NodeVisitor {
    constructor(private analyzer: Analyzer) {}

    visit(fnNode: unknown): boolean {
        const node = fnNode as Function;

        // todo: Attribute, type
        const scope = this.analyzer.resetMember();
        this.analyzer.setMember(createSymbol(node.name, SymbolKind.Function, node.loc, scope));

        return true;
    }
}

// class MethodVisitor {
//     constructor(private analyzer: Analyzer) {}

//     private visitStatement(statement: Node): void {
//         switch (statement.kind) {
//             case 'throw':
//                 this.visitThrowStatement(statement);
//                 break;
//             case 'try':
//                 this.visitTryStatement(statement);
//                 break;
//             case 'return':
//                 this.visitReturnStatement(statement);
//                 break;
//             case 'if':
//                 this.visitIfStatement(statement);
//                 break;
//             case 'for':
//             case 'foreach':
//                 this.visitLoopStatement(statement);
//                 break;
//             case 'expressionstatement':
//                 this.visitExpressionStatement(statement);
//                 break;
//             case 'variableDeclaration':
//                 this.visitVariableDeclaration(statement);
//                 break;
//             // Add more statement types as needed
//             default:
//                 console.log(`Unhandled statement kind: ${statement.kind}`);
//         }
//     }

//     private visitReturnStatement(statement: Return): void {
//         if (statement.expr) {
//             this.visitExpression(statement.expr);
//         }
//     }

//     private visitIfStatement(statement: IfStatement): void {
//         this.visitExpression(statement.test);
//         this.visitBlock(statement.consequent);
//         if (statement.alternate) {
//             this.visitBlock(statement.alternate);
//         }
//     }

//     private visitLoopStatement(statement: LoopStatement): void {
//         // For or foreach loops
//         if (statement.kind === 'for') {
//             statement.init.forEach((init) => this.visitExpression(init));
//             this.visitExpression(statement.test);
//             statement.update.forEach((update) => this.visitExpression(update));
//         } else if (statement.kind === 'foreach') {
//             this.visitExpression(statement.source);
//             this.visitExpression(statement.target);
//         }
//         this.visitBlock(statement.body);
//     }

//     private visitExpressionStatement(statement: ExpressionStatement): void {
//         this.visitExpression(statement.expression);
//     }

//     private visitVariableDeclaration(statement: VariableDeclaration): void {
//         statement.declarations.forEach((declaration) => {
//             const varSymbol = createSymbol(declaration.id.name, declaration.loc, this.analyzer.member.name);
//             this.analyzer.addSymbol(varSymbol);
//             if (declaration.init) {
//                 this.visitExpression(declaration.init);
//             }
//         });
//     }

//     private visitExpression(expression: Expression): void {
//         switch (expression.kind) {
//             case 'callExpression':
//                 this.visitCallExpression(expression);
//                 break;
//             case 'binaryExpression':
//                 this.visitBinaryExpression(expression);
//                 break;
//             case 'memberExpression':
//                 this.visitMemberExpression(expression);
//                 break;
//             // Add more expression types as needed
//             default:
//                 console.log(`Unhandled expression kind: ${expression.kind}`);
//         }
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
