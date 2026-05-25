const fs = require('fs');
const file = 'c:\\Users\\carte\\OneDrive\\Desktop\\Code\\Apps\\New-Project-Script\\Phoenix-Fall\\frontend\\src\\app\\components\\shop\\shop.component.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" \[disabled\]="gameState.gems/g, 'bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.gems');

content = content.replace(/bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-1 hover:brightness-110 transition disabled:opacity-50" \[disabled\]="gameState.gems/g, 'bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-1 hover:brightness-110 transition disabled:opacity-50" [disabled]="gameState.gems');

content = content.replace(/bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-sm flex items-center justify-center gap-1 hover:brightness-110 active:scale-95 transition disabled:opacity-50" \[disabled\]="gameState.gems/g, 'bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-xl font-bold text-sm flex items-center justify-center gap-1 hover:brightness-110 active:scale-95 transition disabled:opacity-50" [disabled]="gameState.gems');

fs.writeFileSync(file, content);
