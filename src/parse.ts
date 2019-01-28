import * as ts from "typescript";

type dict<T> = { [key: string]: T };

export function parseText(fileText: string) {
    let sourceFile = ts.createSourceFile(
        'temp.ts',
        fileText,
        ts.ScriptTarget.ES2015,
        true
    );

    return parse(sourceFile);
}

function parse(sourceFile: ts.SourceFile) {
    const rows: string[] = [];
    sourceFile.forEachChild(node => {
        if (node.kind = ts.SyntaxKind.ClassDeclaration) {
            const dag: dict<string[]> = {};
            let madeIt = false;
            (<ts.ClassDeclaration>node).forEachChild(node => {
                if (node.kind == ts.SyntaxKind.PropertyDeclaration) {
                    madeIt = true;
                    parsePropertyDeclaration(dag, <ts.PropertyDeclaration>node);
                }
            })
            if (madeIt) {
                for (const prop in dag) {
                    if (dag[prop].length) {
                        rows.push(`   { ${dag[prop].join(' ')} } -> ${prop}`);
                    }
                }
            }
        }
    });
    return `digraph {
${rows.join('\n')}    
}
`;
}

function parsePropertyDeclaration(dag: dict<string[]>, prop: ts.PropertyDeclaration) {
    const name = prop.name.getText();
    dag[name] = [];
    prop.forEachChild(node => parsePropertyChild(dag, name, node))
}

function parsePropertyChild(dag: dict<string[]>, name: string, node: ts.Node) {
    switch (node.kind) {
        case ts.SyntaxKind.PropertyAccessExpression:
            parsePropertyAccessExpression(dag, name, <ts.PropertyAccessExpression>node);
            break;
            case ts.SyntaxKind.BinaryExpression:
            break;
        default:
            node.forEachChild(child => parsePropertyChild(dag, name, child))
            break;
    }
}

function parsePropertyAccessExpression(dag: dict<string[]>, name: string, expr: ts.PropertyAccessExpression) {
    if (expr.getChildAt(0).kind == ts.SyntaxKind.ThisKeyword && expr.getChildAt(1).kind == ts.SyntaxKind.DotToken) {
        const identifier = expr.getChildAt(2);
        if (dag.hasOwnProperty(identifier.getText())) {
            dag[name].push(identifier.getText());
        }
        return;
    }
    expr.forEachChild(node => parsePropertyChild(dag, name, node));
}