import { Routes } from '@angular/router';
import { MainMenuComponent } from './components/main-menu/main-menu.component';
import { ShopComponent } from './components/shop/shop.component';
import { LoginComponent } from './login/login.component';
import { GameComponent } from './components/game/game.component';
import { ProfileComponent } from './components/profile/profile.component';
import { LeaderboardComponent } from './components/leaderboard/leaderboard.component';
import { CodexComponent } from './codex/codex.component';

export const routes: Routes = [
  { path: '', redirectTo: 'menu', pathMatch: 'full' },
  { path: 'menu', component: MainMenuComponent },
  { path: 'shop', component: ShopComponent },
  { path: 'login', component: LoginComponent },
  { path: 'game', component: GameComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'leaderboard', component: LeaderboardComponent },
  { path: 'codex', component: CodexComponent },
  { path: 'crate_opening', loadComponent: () => import('./components/crate-opening/crate-opening.component').then(m => m.CrateOpeningComponent) }
];
