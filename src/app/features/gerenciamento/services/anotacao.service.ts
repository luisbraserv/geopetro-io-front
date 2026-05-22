import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { parseApiError } from '../../../core/http/api-error';
import { environment } from '../../../../environments/environment';
import { Anotacao, AnotacaoPayload } from '../models/processo.model';

@Injectable({ providedIn: 'root' })
export class AnotacaoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/processos`;

  listarPorProcesso(processoId: number): Observable<Anotacao[]> {
    return this.http
      .get<Anotacao[]>(`${this.apiUrl}/${processoId}/anotacoes`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  buscarPorId(processoId: number, anotacaoId: number): Observable<Anotacao> {
    return this.http
      .get<Anotacao>(`${this.apiUrl}/${processoId}/anotacoes/${anotacaoId}`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  criar(processoId: number, payload: AnotacaoPayload): Observable<Anotacao> {
    return this.http
      .post<Anotacao>(`${this.apiUrl}/${processoId}/anotacoes`, payload)
      .pipe(catchError((error) => this.handleError(error)));
  }

  atualizar(processoId: number, anotacaoId: number, payload: AnotacaoPayload): Observable<Anotacao> {
    return this.http
      .put<Anotacao>(`${environment.apiUrl}/api/anotacoes/${anotacaoId}`, payload)
      .pipe(catchError((error) => this.handleError(error)));
  }

  excluir(processoId: number, anotacaoId: number): Observable<void> {
    return this.http
      .delete<void>(`${environment.apiUrl}/api/anotacoes/${anotacaoId}`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  private handleError(error: unknown): Observable<never> {
    return throwError(() => new Error(parseApiError(error)));
  }
}
