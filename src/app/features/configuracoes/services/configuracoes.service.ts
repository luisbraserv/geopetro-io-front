import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { parseApiError } from '../../../core/http/api-error';
import { environment } from '../../../../environments/environment';
import { ConfiguracaoEmail, ConfiguracaoEmailPayload } from '../models/configuracao-email.model';

@Injectable({ providedIn: 'root' })
export class ConfiguracoesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  buscarEmail(): Observable<ConfiguracaoEmail> {
    return this.http
      .get<ConfiguracaoEmail>(`${this.apiUrl}/api/configuracoes/email`)
      .pipe(catchError((error) => throwError(() => new Error(parseApiError(error)))));
  }

  salvarEmail(payload: ConfiguracaoEmailPayload): Observable<ConfiguracaoEmail> {
    return this.http
      .put<ConfiguracaoEmail>(`${this.apiUrl}/api/configuracoes/email`, payload)
      .pipe(catchError((error) => throwError(() => new Error(parseApiError(error)))));
  }

  enviarTeste(): Observable<void> {
    return this.http
      .post<void>(`${this.apiUrl}/api/configuracoes/email/teste`, {})
      .pipe(catchError((error) => throwError(() => new Error(parseApiError(error)))));
  }
}
