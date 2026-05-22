import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { parseApiError } from '../../../core/http/api-error';
import { environment } from '../../../../environments/environment';
import { Observacao, ObservacaoPayload } from '../models/processo.model';

@Injectable({ providedIn: 'root' })
export class ObservacaoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/observacoes`;

  listarPorSetores(setorIds: number[]): Observable<Observacao[]> {
    let params = new HttpParams();
    setorIds.forEach((id) => (params = params.append('setorIds', id)));
    return this.http.get<Observacao[]>(this.apiUrl, { params }).pipe(catchError((e) => this.handleError(e)));
  }

  listarPorSetor(setorId: number): Observable<Observacao[]> {
    const params = new HttpParams().set('setorId', setorId);
    return this.http.get<Observacao[]>(this.apiUrl, { params }).pipe(catchError((e) => this.handleError(e)));
  }

  criar(payload: ObservacaoPayload): Observable<Observacao> {
    return this.http.post<Observacao>(this.apiUrl, payload).pipe(catchError((e) => this.handleError(e)));
  }

  atualizar(id: number, payload: ObservacaoPayload): Observable<Observacao> {
    return this.http.put<Observacao>(`${this.apiUrl}/${id}`, payload).pipe(catchError((e) => this.handleError(e)));
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(catchError((e) => this.handleError(e)));
  }

  private handleError(error: unknown): Observable<never> {
    return throwError(() => new Error(parseApiError(error)));
  }
}
