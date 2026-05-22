import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { parseApiError } from '../../../core/http/api-error';
import { environment } from '../../../../environments/environment';
import { Setor, SetorPayload } from '../models/cadastros.model';

@Injectable({ providedIn: 'root' })
export class SetorService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/setores`;

  listar(): Observable<Setor[]> {
    return this.http.get<Setor[]>(this.apiUrl).pipe(catchError((error) => this.handleError(error)));
  }

  buscarPorId(id: number): Observable<Setor> {
    return this.http.get<Setor>(`${this.apiUrl}/${id}`).pipe(catchError((error) => this.handleError(error)));
  }

  criar(payload: SetorPayload): Observable<Setor> {
    return this.http.post<Setor>(this.apiUrl, payload).pipe(catchError((error) => this.handleError(error)));
  }

  atualizar(id: number, payload: SetorPayload): Observable<Setor> {
    return this.http.put<Setor>(`${this.apiUrl}/${id}`, payload).pipe(catchError((error) => this.handleError(error)));
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(catchError((error) => this.handleError(error)));
  }

  private handleError(error: unknown): Observable<never> {
    return throwError(() => new Error(parseApiError(error)));
  }
}
