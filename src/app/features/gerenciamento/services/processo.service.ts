import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { parseApiError } from '../../../core/http/api-error';
import { environment } from '../../../../environments/environment';
import { Processo, ProcessoFiltros, ProcessoPayload } from '../models/processo.model';

@Injectable({ providedIn: 'root' })
export class ProcessoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/processos`;

  listar(filtros: ProcessoFiltros = {}): Observable<Processo[]> {
    let params = new HttpParams();
    Object.entries(filtros).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.filter(Boolean).forEach((item) => params = params.append(key, String(item)));
      } else if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<Processo[]>(this.apiUrl, { params }).pipe(catchError((error) => this.handleError(error)));
  }

  buscarPorId(id: number): Observable<Processo> {
    return this.http.get<Processo>(`${this.apiUrl}/${id}`).pipe(catchError((error) => this.handleError(error)));
  }

  criar(payload: ProcessoPayload): Observable<Processo> {
    return this.http.post<Processo>(this.apiUrl, this.limparPayload(payload)).pipe(catchError((error) => this.handleError(error)));
  }

  atualizar(id: number, payload: ProcessoPayload): Observable<Processo> {
    return this.http.put<Processo>(`${this.apiUrl}/${id}`, this.limparPayload(payload)).pipe(catchError((error) => this.handleError(error)));
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(catchError((error) => this.handleError(error)));
  }

  arquivar(id: number): Observable<Processo> {
    return this.http.patch<Processo>(`${this.apiUrl}/${id}/arquivar`, {}).pipe(catchError((error) => this.handleError(error)));
  }

  desarquivar(id: number): Observable<Processo> {
    return this.http.patch<Processo>(`${this.apiUrl}/${id}/desarquivar`, {}).pipe(catchError((error) => this.handleError(error)));
  }

  private handleError(error: unknown): Observable<never> {
    return throwError(() => new Error(parseApiError(error)));
  }

  private limparPayload(payload: ProcessoPayload): ProcessoPayload {
    return {
      ...payload,
      dataInicio: payload.dataInicio || null,
      dataPrevisaoConclusao: payload.dataPrevisaoConclusao || null,
      dataFim: payload.dataFim || null,
    };
  }
}
