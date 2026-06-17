import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

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
  // Backend-Telemetria (:8081) — endpoint de consulta de séries no InfluxDB
  private readonly telemetriaUrl = `${environment.telemetriaUrl}/api/monitoramentos`;

  listarMinhas(): Observable<SondaDisponivel[]> {
    // Retorna lista estática enquanto não existe endpoint de sondas no backend-telemetria.
    // Estas unidades correspondem ao seed de telemetria no InfluxDB e ao cadastro em unidades_sondas.
    return new Observable(obs => {
      obs.next([
        { idSondaUnidade: 'SPT-144', nome: 'SPT-144', apelido: 'SPT-144' },
        { idSondaUnidade: 'SPT-145', nome: 'SPT-145', apelido: 'SPT-145' },
      ]);
      obs.complete();
    });
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
      `${this.telemetriaUrl}/sondas/${encodeURIComponent(idSondaUnidade)}/series`,
      { params }
    );
  }
}
