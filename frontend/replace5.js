const fs = require('fs');
const file = 'c:\\Users\\carte\\OneDrive\\Desktop\\Code\\Apps\\New-Project-Script\\Phoenix-Fall\\frontend\\src\\app\\components\\shop\\shop.component.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/this\.gameState\.audio\.playSFX\('upgrade'\)/g, "this.gameState.audio.playSFX('buy')");

fs.writeFileSync(file, content);
