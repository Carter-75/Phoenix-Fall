const fs = require('fs');
const ts = require('typescript');

const code = fs.readFileSync('c:/Users/carte/OneDrive/Desktop/Code/Apps/New-Project-Script/Phoenix-Fall/frontend/src/app/services/game-state.service.ts', 'utf8');
const sourceFile = ts.createSourceFile('game-state.service.ts', code, ts.ScriptTarget.Latest, true);

const diagnostics = Array.from(sourceFile.parseDiagnostics);

if (diagnostics.length > 0) {
    console.log("TypeScript Syntax Errors:");
    for (const d of diagnostics) {
        const pos = sourceFile.getLineAndCharacterOfPosition(d.start);
        console.log(`Line ${pos.line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
    }
} else {
    console.log("No syntax errors found by TypeScript parser!");
}
