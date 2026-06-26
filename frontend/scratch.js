const fs = require('fs');
const code = fs.readFileSync('c:/Users/carte/OneDrive/Desktop/Code/Apps/New-Project-Script/Phoenix-Fall/frontend/src/app/services/game-state.service.ts', 'utf8');

let depth = 0;
let lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') depth++;
        if (line[j] === '}') {
            depth--;
            if (depth < 0) {
                console.log(`Extra closing brace found at line ${i + 1}, column ${j + 1}`);
            }
        }
    }
}

if (depth !== 0) {
    console.log(`Unbalanced braces at end of file. Depth: ${depth}`);
} else {
    console.log("Braces are balanced (according to simple counting).");
}
