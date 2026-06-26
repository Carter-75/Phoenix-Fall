const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Fix app.routes.ts
let routesPath = 'c:/Users/carte/OneDrive/Desktop/Code/Apps/New-Project-Script/Phoenix-Fall/frontend/src/app/app.routes.ts';
if (fs.existsSync(routesPath)) {
    let code = fs.readFileSync(routesPath, 'utf8');
    code = code.replace(/import \{ ShopComponent \} from '\.\/components\/shop\/shop\.component';/, "import { ShopComponent } from './pages/shop/shop.component';");
    code = code.replace(/import \{ LoginComponent \} from '\.\/login\/login\.component';/, "import { LoginComponent } from './pages/login/login.component';");
    code = code.replace(/import \{ GameComponent \} from '\.\/components\/game\/game\.component';/, "import { GameComponent } from './pages/game/game.component';");
    code = code.replace(/import \{ ProfileComponent \} from '\.\/components\/profile\/profile\.component';/, "import { ProfileComponent } from './pages/profile/profile.component';");
    code = code.replace(/import \{ LeaderboardComponent \} from '\.\/components\/leaderboard\/leaderboard\.component';/, "import { LeaderboardComponent } from './pages/leaderboard/leaderboard.component';");
    code = code.replace(/import \{ CodexComponent \} from '\.\/codex\/codex\.component';/, "import { CodexComponent } from './pages/codex/codex.component';");
    code = code.replace(/import \{ DashboardComponent \} from '\.\/dashboard\/dashboard\.component';/, "import { DashboardComponent } from './pages/dashboard/dashboard.component';");
    
    // Also home
    code = code.replace(/import \{ HomeComponent \} from '\.\/home\/home\.component';/, "import { HomeComponent } from './pages/home/home.component';");
    
    // Also settings
    code = code.replace(/import \{ SettingsComponent \} from '\.\/components\/settings\/settings\.component';/, "import { SettingsComponent } from './pages/settings/settings.component';");

    fs.writeFileSync(routesPath, code);
}

// Fix main-menu
let menuPath = 'c:/Users/carte/OneDrive/Desktop/Code/Apps/New-Project-Script/Phoenix-Fall/frontend/src/app/components/main-menu/main-menu.component.ts';
if (fs.existsSync(menuPath)) {
    let code = fs.readFileSync(menuPath, 'utf8');
    code = code.replace(/import \{ SettingsComponent \} from '\.\.\/settings\/settings\.component';/, "import { SettingsComponent } from '../../pages/settings/settings.component';");
    fs.writeFileSync(menuPath, code);
}

console.log("Fixed explicit imports");
