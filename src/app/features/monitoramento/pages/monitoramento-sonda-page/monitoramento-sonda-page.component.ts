import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { MonitoramentoSondaService, SondaDisponivel, MonitoramentoSerie } from '../../services/monitoramento-sonda.service';
import { GraficoMonitoramentoComponent } from '../../components/grafico-monitoramento/grafico-monitoramento.component';

@Component({
  selector: 'app-monitoramento-sonda-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TuiButton, TuiIcon, GraficoMonitoramentoComponent],
  templateUrl: './monitoramento-sonda-page.component.html',
  styleUrl: './monitoramento-sonda-page.component.css',
})
export class MonitoramentoSondaPageComponent implements OnInit {
  private readonly service = inject(MonitoramentoSondaService);

  readonly sondas = signal<SondaDisponivel[]>([]);
  readonly sondaSelecionada = signal<SondaDisponivel | null>(null);
  readonly dispositivoSelecionado = signal<string>('');
  readonly periodo = signal<string>('1h');
  readonly inicioPeriodo = signal<string>('');
  readonly fimPeriodo = signal<string>('');
  readonly carregando = signal(false);
  readonly serie = signal<MonitoramentoSerie | null>(null);
  readonly semDados = signal(false);
  readonly erro = signal<string | null>(null);

  readonly dispositivos = [
    { id: 'PRESSAO-01', label: 'Pressão de Bombeio' },
    { id: 'VAZAO-01', label: 'Vazão de Bombeio' },
    { id: 'DENSIDADE-01', label: 'Densidade da Pasta' },
    { id: 'TEMPERATURA-01', label: 'Temperatura de Fundo' },
  ];

  readonly periodos = [
    { value: '15m', label: 'Últimos 15 minutos' },
    { value: '1h', label: 'Última 1 hora' },
    { value: '6h', label: 'Últimas 6 horas' },
    { value: 'custom', label: 'Personalizado' },
  ];

  // Getters/setters para two-way binding com signals
  get sondaSelecionadaValue() { return this.sondaSelecionada(); }
  set sondaSelecionadaValue(v: SondaDisponivel | null) { this.sondaSelecionada.set(v); }

  get dispositivoSelecionadoValue() { return this.dispositivoSelecionado(); }
  set dispositivoSelecionadoValue(v: string) { this.dispositivoSelecionado.set(v); }

  get periodoValue() { return this.periodo(); }
  set periodoValue(v: string) { this.periodo.set(v); }

  get inicioPeriodoValue() { return this.inicioPeriodo(); }
  set inicioPeriodoValue(v: string) { this.inicioPeriodo.set(v); }

  get fimPeriodoValue() { return this.fimPeriodo(); }
  set fimPeriodoValue(v: string) { this.fimPeriodo.set(v); }

  readonly podeconsultar = computed(() =>
    !!this.sondaSelecionada() && !!this.dispositivoSelecionado() &&
    (this.periodo() !== 'custom' || (!!this.inicioPeriodo() && !!this.fimPeriodo()))
  );

  ngOnInit() {
    this.service.listarMinhas().subscribe({
      next: (sondas) => this.sondas.set(sondas),
      error: () => this.erro.set('Erro ao carregar sondas disponíveis.'),
    });
  }

  onSondaChange() {
    this.serie.set(null);
    this.semDados.set(false);
    this.erro.set(null);
  }

  onDispositivoChange() {
    this.serie.set(null);
    this.semDados.set(false);
    this.erro.set(null);
  }

  private calcularPeriodo(): { inicio: string; fim: string } {
    const fim = new Date();
    let inicio = new Date();
    const p = this.periodo();
    if (p === '15m') inicio = new Date(fim.getTime() - 15 * 60 * 1000);
    else if (p === '1h') inicio = new Date(fim.getTime() - 60 * 60 * 1000);
    else if (p === '6h') inicio = new Date(fim.getTime() - 6 * 60 * 60 * 1000);
    else return { inicio: this.inicioPeriodo(), fim: this.fimPeriodo() };
    return { inicio: inicio.toISOString(), fim: fim.toISOString() };
  }

  consultar() {
    const sonda = this.sondaSelecionada();
    const dispositivo = this.dispositivoSelecionado();
    if (!sonda || !dispositivo) return;

    this.carregando.set(true);
    this.serie.set(null);
    this.semDados.set(false);
    this.erro.set(null);

    const { inicio, fim } = this.calcularPeriodo();

    this.service.consultarSerie(sonda.idSondaUnidade, dispositivo, inicio, fim).subscribe({
      next: (data) => {
        this.carregando.set(false);
        if (!data.pontos || data.pontos.length === 0) {
          this.semDados.set(true);
        } else {
          this.serie.set(data);
        }
      },
      error: (err) => {
        this.carregando.set(false);
        if (err.status === 403) {
          this.erro.set('Você não tem permissão para acessar esta sonda.');
        } else if (err.status === 502) {
          this.erro.set('Serviço de telemetria indisponível no momento.');
        } else {
          this.erro.set('Erro ao consultar dados de telemetria.');
        }
      },
    });
  }
}
