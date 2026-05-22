import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { parseApiError } from '../../../core/http/api-error';
import { AuthenticatedUser, UserRole } from '../models/user.model';

interface AuthResponse {
  token: string;
  username: string;
  nome: string;
  email: string;
  endereco: string | null;
  telefone: string;
  roles: UserRole[];
  setorId?: number | null;
  setorNome?: string | null;
  setorIds?: number[];
  setorNomes?: string[];
}

export class AuthException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthException';
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  authenticate$(
    username: string,
    password: string,
  ): Observable<AuthenticatedUser> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/login`, { username, password })
      .pipe(
        map((response) => ({
          ...response,
          role: response.roles[0] ?? 'USER',
          roles: response.roles ?? [],
          setorIds: response.setorIds?.length ? response.setorIds : response.setorId ? [response.setorId] : [],
          setorNomes: response.setorNomes?.length ? response.setorNomes : response.setorNome ? [response.setorNome] : [],
        })),
        catchError((error) =>
          throwError(() => new AuthException(parseApiError(error))),
        ),
      );
  }
}
