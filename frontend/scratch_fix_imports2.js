const fs = require('fs');
const glob = require('glob');
const path = require('path');

// The directories that moved from src/app/ to src/app/pages/ (depth increased by 1)
const movedFromRootToPages = ['codex', 'dashboard', 'home', 'login'];

// The directories that moved from src/app/components/ to src/app/pages/ (depth stayed the same)
// wait, if they moved from src/app/components to src/app/pages, their relative paths to src/app/services are STILL ../../services. So they don't need changes!
// Actually wait! If `game` was in `src/app/components/game`, it imported services from `../../services`. Now it is in `src/app/pages/game`, so `../../services` is still correct.
// But what about imports from OTHER components?
// `game` used to import `BattleAiService` from `../../services/battle-ai.service`. Still works.
// Did `game` import anything from `src/app/components/`? Yes, maybe `ParticleBgComponent`?
// Let's check.

function fixImports(dir, depthChanged) {
    const files = glob.sync(`c:/Users/carte/OneDrive/Desktop/Code/Apps/New-Project-Script/Phoenix-Fall/frontend/src/app/pages/${dir}/**/*.ts`);
    for (const file of files) {
        let code = fs.readFileSync(file, 'utf8');
        let originalCode = code;
        
        if (depthChanged) {
            // Need to add an extra ../ to anything starting with ../
            code = code.replace(/from '\.\.\/([^']+)'/g, "from '../../$1'");
            
            // Except if they were importing from another component that ALSO moved, like from '../dashboard' -> now it's '../dashboard' (wait, depth increased, so sibling is still ../ sibling, actually if they are both in pages, it's just ../dashboard.
            // Wait, if home imported dashboard, it was `../dashboard`, and now it's still `../dashboard`. So adding an extra `../` makes it `../../dashboard` which points to `src/app/dashboard`, breaking it.
            // Let's be specific. We only need to fix imports pointing to services, constants, models, components.
            code = code.replace(/from '\.\.\/\.\.\/(services|constants|models|components)/g, "from '../../../$1'");
            code = code.replace(/from '\.\.\/(services|constants|models|components)/g, "from '../../$1'");
        }
        
        // Also fix any imports pointing to components that moved to pages
        code = code.replace(/from '([^']*(?:\/|\.\.\/))components\/(game|leaderboard|profile|settings|shop)(\/[^']*)'/g, "from '$1pages/$2$3'");
        
        if (code !== originalCode) {
            fs.writeFileSync(file, code);
            console.log(`Updated ${file}`);
        }
    }
}

movedFromRootToPages.forEach(d => fixImports(d, true));

// For the ones that moved from components to pages, depth didn't change
const movedFromComponentsToPages = ['game', 'leaderboard', 'profile', 'settings', 'shop'];
movedFromComponentsToPages.forEach(d => fixImports(d, false));

// Also fix imports in the remaining components (depth unchanged)
const remainingComponents = ['ad-bubble', 'crate-opening', 'main-menu', 'particle-bg', 'policies'];
for (const d of remainingComponents) {
    const files = glob.sync(`c:/Users/carte/OneDrive/Desktop/Code/Apps/New-Project-Script/Phoenix-Fall/frontend/src/app/components/${d}/**/*.ts`);
    for (const file of files) {
        let code = fs.readFileSync(file, 'utf8');
        let originalCode = code;
        
        // Fix any imports pointing to components that moved to pages
        code = code.replace(/from '([^']*(?:\/|\.\.\/))components\/(game|leaderboard|profile|settings|shop)(\/[^']*)'/g, "from '$1pages/$2$3'");
        
        // Also if they imported from root (like home, login), those moved to pages
        // e.g. from '../../home/home.component' -> from '../../pages/home/home.component'
        code = code.replace(/from '([^']*(?:\/|\.\.\/))(codex|dashboard|home|login)(\/[^']*)'/g, "from '$1pages/$2$3'");

        if (code !== originalCode) {
            fs.writeFileSync(file, code);
            console.log(`Updated ${file}`);
        }
    }
}
