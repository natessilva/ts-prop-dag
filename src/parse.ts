import * as ts from "typescript";

type dict<T> = {[key:string]:T };

export function parseText(fileText:string){
    let sourceFile = ts.createSourceFile(
        'temp.ts',
        fileText,
        ts.ScriptTarget.ES2015,
        true
      );
    
     return parse(sourceFile);
}

function parse(sourceFile: ts.SourceFile){
    const rows:string[] = [];
    sourceFile.forEachChild(node=>{
        if(node.kind = ts.SyntaxKind.ClassDeclaration){
            const dag:dict<string[]> = {};
            let madeIt = false;
            (<ts.ClassDeclaration>node).forEachChild(node=>{
                if(node.kind == ts.SyntaxKind.PropertyDeclaration){
                    madeIt = true;
                    parsePropertyDeclaration(dag, <ts.PropertyDeclaration>node);
                }
            })
            if(madeIt){
                for(const prop in dag){
                    if(dag[prop].length){
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

function parsePropertyDeclaration(dag:dict<string[]>, prop:ts.PropertyDeclaration){
    const name = prop.name.getText();
    dag[name] = [];
    prop.forEachChild(node=>{
        if(node.kind = ts.SyntaxKind.CallExpression){
            parseCallExpression(dag,name, <ts.CallExpression>node);
        }
    })
}

function parsePropertyAccessExpression(dag:dict<string[]>, name:string,expr:ts.PropertyAccessExpression){
    expr.forEachChild(node=>{
        switch(node.kind){
            case ts.SyntaxKind.Identifier:
            if(dag[node.getText()]){
                dag[name].push(node.getText());
            }
            break;
            case ts.SyntaxKind.PropertyAccessExpression:
            parsePropertyAccessExpression(dag, name,<ts.PropertyAccessExpression>node);
            break;
            case ts.SyntaxKind.CallExpression:
            parseCallExpression(dag, name,<ts.CallExpression>node);
            break;
        }
    });
}

function parseCallExpression(dag:dict<string[]>,name:string, expr:ts.CallExpression){
    expr.forEachChild(node=>{
        if(node.kind = ts.SyntaxKind.PropertyAccessExpression){
           parsePropertyAccessExpression(dag,name, (<ts.PropertyAccessExpression>node));
        }
    })
}