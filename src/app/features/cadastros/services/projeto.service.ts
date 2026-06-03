import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { parseApiError } from '../../../core/http/api-error';
import { environment } from '../../../../environments/environment';
import { Pagina } from '../../../shared/models/pagina.model';
import { Projeto, ProjetoPayload } from '../models/cadastros.model';

@Injectable({ providedIn: 'root' })
export class ProjetoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/projetos`;

  listar(regionalId?: number | null): Observable<Projeto[]> {
    const params = regionalId ? new HttpParams().set('regionalId', String(regionalId)) : undefined;
    return this.http.get<Projeto[]>(this.apiUrl, { params }).pipe(catchError((error) => this.handleError(error)));
  }

  listarPaginado(pagina = 0, tamanho = 10, busca = '', regionalId?: number | null): Observable<Pagina<Projeto>> {
    let params = new HttpParams().set('pagina', pagina).set('tamanho', tamanho);
    if (busca) params = params.set('busca', busca);
    if (regionalId) params = params.set('regionalId', String(regionalId));
    return this.http
      .get<Pagina<Projeto>>(`${this.apiUrl}/paginado`, { params })
      .pipe(catchError((error) => this.handleError(error)));
  }

  buscarPorId(id: number): Observable<Projeto> {
    return this.http.get<Projeto>(`${this.apiUrl}/${id}`).pipe(catchError((error) => this.handleError(error)));
  }

  criar(payload: ProjetoPayload): Observable<Projeto> {
    return this.http.post<Projeto>(this.apiUrl, this.limparPayload(payload)).pipe(catchError((error) => this.handleError(error)));
  }

  atualizar(id: number, payload: ProjetoPayload): Observable<Projeto> {
    return this.http.put<Projeto>(`${this.apiUrl}/${id}`, this.limparPayload(payload)).pipe(catchError((error) => this.handleError(error)));
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(catchError((error) => this.handleError(error)));
  }

  private limparPayload(payload: ProjetoPayload): ProjetoPayload {
    return { ...payload, responsavelUsername: payload.responsavelUsername || null };
  }

  private handleError(error: unknown): Observable<never> {
    return throwError(() => new Error(parseApiError(error)));
  }
}
