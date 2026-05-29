import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SondaDisponivel {
  idSondaUnidade: string;
  nome: string;
  apelido: string;
}

export interface MonitoramentoPonto {
  dataHora: string;
  valor: number;
}

export interface MonitoramentoSerie {
  idSondaUnidade: string;
  dispositivoId: string;
  pontos: MonitoramentoPonto[];
}

@Injectable({ providedIn: 'root' })
export class MonitoramentoSondaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080/api/sondas';

  listarMinhas(): Observable<SondaDisponivel[]> {
    return this.http.get<SondaDisponivel[]>(`${this.baseUrl}/minhas`);
  }

  consultarSerie(
    idSondaUnidade: string,
    dispositivoId: string,
    inicio: string,
    fim: string
  ): Observable<MonitoramentoSerie> {
    const params = new HttpParams()
      .set('dispositivoId', dispositivoId)
      .set('inicio', inicio)
      .set('fim', fim);
    return this.http.get<MonitoramentoSerie>(
      `${this.baseUrl}/${encodeURIComponent(idSondaUnidade)}/monitoramentos/series`,
      { params }
    );
  }
}
