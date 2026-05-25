import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface User {
  _id: string;
  username: string;
  email?: string;
  level: number;
  xp: number;
  coins: number;
  gems: number;
  unlockedWorlds: number[];
  trophies: string[];
  isTemp?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  public currentUser = signal<User | null>(null);

  private apiUrl = '/api/auth';

  login(credentials: any): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/login`, credentials).pipe(
      tap(user => this.currentUser.set(user))
    );
  }

  register(data: any): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/register`, data).pipe(
      tap(user => this.currentUser.set(user))
    );
  }

  completeSignup(username: string): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/complete-signup`, { username }).pipe(
      tap(user => this.currentUser.set(user))
    );
  }

  loginWithGoogle(): void {
    window.location.href = `${this.apiUrl}/google`;
  }

  checkStatus(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/user`).pipe(
      tap({
        next: user => this.currentUser.set(user),
        error: () => this.currentUser.set(null)
      })
    );
  }

  logout(): void {
    this.http.get(`${this.apiUrl}/logout`).subscribe(() => {
      this.currentUser.set(null);
    });
  }
}
