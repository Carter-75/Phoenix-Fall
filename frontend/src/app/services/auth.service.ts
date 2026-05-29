import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

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
  acceptedLegalPolicies?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  public currentUser = signal<User | null>(null);

  private apiUrl = environment.apiUrl + '/auth';

  login(credentials: any): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/login`, credentials).pipe(
      tap(user => this.currentUser.set(user))
    );
  }

  sync(data: Partial<User>): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/sync`, data).pipe(
      tap(user => this.currentUser.set(user))
    );
  }

  acceptPolicies(): Observable<any> {
    return this.http.post(`${this.apiUrl}/accept-policies`, {}).pipe(
      tap(() => {
        const user = this.currentUser();
        if (user) {
          this.currentUser.set({ ...user, acceptedLegalPolicies: true });
        }
      })
    );
  }

  deleteAccount(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/user`).pipe(
      tap(() => this.currentUser.set(null))
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
