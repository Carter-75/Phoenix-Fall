import { Component } from '@angular/core';
import { ParticleBgComponent } from './components/particle-bg/particle-bg.component';
import { MainMenuComponent } from './components/main-menu/main-menu.component';
import { ShopComponent } from './components/shop/shop.component';
import { LoginComponent } from './login/login.component';
import { GameComponent } from './components/game/game.component';
import { ProfileComponent } from './components/profile/profile.component';
import { LeaderboardComponent } from './components/leaderboard/leaderboard.component';
import { GameStateService } from './services/game-state.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ParticleBgComponent, MainMenuComponent, ShopComponent, LoginComponent, GameComponent, ProfileComponent, LeaderboardComponent],
  template: `
    <app-particle-bg></app-particle-bg>
    
    <div class="absolute inset-0 z-10 w-full h-full min-h-screen">
      @if (gameState.activeScreen() === 'menu') {
        <app-main-menu></app-main-menu>
      }
      
      @if (gameState.activeScreen() === 'shop') {
        <app-shop></app-shop>
      }

      @if (gameState.activeScreen() === 'login') {
        <app-login></app-login>
      }
      
      @if (gameState.activeScreen() === 'game') {
        <app-game></app-game>
      }

      @if (gameState.activeScreen() === 'profile') {
        <app-profile></app-profile>
      }

      @if (gameState.activeScreen() === 'leaderboard') {
        <app-leaderboard></app-leaderboard>
      }
    </div>
  `,
})
export class App {
  constructor(public gameState: GameStateService, private auth: AuthService) {
      this.auth.checkStatus().subscribe(user => {
          if (user) this.gameState.syncWithUser(user);
      });
  }
}
