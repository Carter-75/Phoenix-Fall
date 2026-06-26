const fs = require('fs');
const glob = require('glob');

const files = glob.sync('c:/Users/carte/OneDrive/Desktop/Code/Apps/New-Project-Script/Phoenix-Fall/frontend/src/app/**/*.ts');

for (const file of files) {
    let code = fs.readFileSync(file, 'utf8');
    let original = code;
    
    // Fix the stray quotes added by my mistake
    code = code.replace(/from '([^']+)'\//g, "from '$1/");
    code = code.replace(/from '([^']+)'\./g, "from '$1.");
    
    // For anything in pages that is 1 level deep (like home, login) the services are ../../services
    // Let's just blindly fix path depths based on the file's current location relative to src/app/
    
    if (code !== original) {
        fs.writeFileSync(file, code);
        console.log("Fixed quotes in: " + file);
    }
}
