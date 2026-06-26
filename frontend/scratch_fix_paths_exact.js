const fs = require('fs');
const glob = require('glob');
const path = require('path');

const srcAppDir = 'c:/Users/carte/OneDrive/Desktop/Code/Apps/New-Project-Script/Phoenix-Fall/frontend/src/app';
const files = glob.sync(`${srcAppDir}/**/*.ts`);

for (const file of files) {
    let code = fs.readFileSync(file, 'utf8');
    let original = code;
    const fileDir = path.dirname(file);
    
    code = code.replace(/from '((?:\.\.\/)+)(services|constants|models|components|pages)([^']*)'/g, (match, upDirs, folder, rest) => {
        // Evaluate the absolute path this import used to point to (roughly, but it might be wrong right now)
        // Actually, we KNOW that `services`, `constants`, `models` are ALWAYS in `src/app/`.
        // So we can just dynamically calculate the relative path from `fileDir` to `src/app/${folder}`.
        if (['services', 'constants', 'models'].includes(folder)) {
            const targetDir = path.join(srcAppDir, folder);
            let relative = path.relative(fileDir, targetDir).replace(/\\/g, '/');
            if (!relative.startsWith('.')) relative = './' + relative;
            return `from '${relative}${rest}'`;
        }
        return match;
    });

    if (code !== original) {
        fs.writeFileSync(file, code);
        console.log(`Fixed paths in: ${file}`);
    }
}
