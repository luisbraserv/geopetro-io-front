import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { forkJoin } from 'rxjs';
import { MonitoramentoSondaService, SondaDisponivel, MonitoramentoSerie } from '../../services/monitoramento-sonda.service';
import { GraficoMonitoramentoComponent } from '../../components/grafico-monitoramento/grafico-monitoramento.component';

@Component({
  selector: 'app-monitoramento-sonda-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TuiButton, TuiIcon, GraficoMonitoramentoComponent],
  templateUrl: './monitoramento-sonda-page.component.html',
  styleUrl: './monitoramento-sonda-page.component.css',
})
export class MonitoramentoSondaPageComponent implements OnInit, OnDestroy {
  private readonly service = inject(MonitoramentoSondaService);
  private abrirSerieTimer: ReturnType<typeof setTimeout> | null = null;

  readonly todosDispositivos = '__todos__';
  readonly sondas = signal<SondaDisponivel[]>([]);
  readonly sondaSelecionada = signal<SondaDisponivel | null>(null);
  readonly dispositivoSelecionado = signal<string>('');
  readonly periodo = signal<string>('1h');
  readonly inicioPeriodo = signal<string>('');
  readonly fimPeriodo = signal<string>('');
  readonly carregando = signal(false);
  readonly gerandoPdf = signal(false);
  readonly series = signal<MonitoramentoSerie[]>([]);
  readonly serieAberta = signal<MonitoramentoSerie | null>(null);
  readonly carregandoModalGrafico = signal(false);
  readonly semDados = signal(false);
  readonly erro = signal<string | null>(null);
  readonly modalGraficoAberto = computed(() => this.carregandoModalGrafico() || !!this.serieAberta());
  readonly periodoConsultado = signal<{ inicio: string; fim: string } | null>(null);

  readonly dispositivos = [
    { id: 'VAZAO_01', label: 'Vazão' },
    { id: 'PESO_COLUNA_01', label: 'Peso da Coluna' },
    { id: 'TORQUE_01', label: 'T. Ch. Hid. Tubos' },
    { id: 'TORQUE_02', label: 'T. Ch. Flutuante' },
    { id: 'PRESSAO_01', label: 'P. Bomba / ESCP' },
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

  ngOnDestroy() {
    this.cancelarAberturaGrafico();
  }

  onSondaChange() {
    this.series.set([]);
    this.serieAberta.set(null);
    this.carregandoModalGrafico.set(false);
    this.periodoConsultado.set(null);
    this.semDados.set(false);
    this.erro.set(null);
  }

  onDispositivoChange() {
    this.series.set([]);
    this.serieAberta.set(null);
    this.carregandoModalGrafico.set(false);
    this.periodoConsultado.set(null);
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
    this.series.set([]);
    this.serieAberta.set(null);
    this.carregandoModalGrafico.set(false);
    this.semDados.set(false);
    this.erro.set(null);

    const { inicio, fim } = this.calcularPeriodo();
    this.periodoConsultado.set({ inicio, fim });
    const consultas = dispositivo === this.todosDispositivos
      ? this.dispositivos.map(d => this.service.consultarSerie(sonda.idUnidade, d.id, inicio, fim))
      : [this.service.consultarSerie(sonda.idUnidade, dispositivo, inicio, fim)];

    forkJoin(consultas).subscribe({
      next: (series) => {
        this.carregando.set(false);
        const seriesComDados = series.filter(serie => serie.pontos?.length > 0);
        if (seriesComDados.length === 0) {
          this.semDados.set(true);
        } else {
          this.series.set(seriesComDados);
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

  rotuloDispositivo(dispositivoId: string): string {
    return this.dispositivos.find(d => d.id === dispositivoId)?.label || dispositivoId;
  }

  abrirSerie(serie: MonitoramentoSerie) {
    this.cancelarAberturaGrafico();
    this.serieAberta.set(null);
    this.carregandoModalGrafico.set(true);

    this.abrirSerieTimer = setTimeout(() => {
      this.serieAberta.set(serie);
      this.carregandoModalGrafico.set(false);
      this.abrirSerieTimer = null;
    }, 120);
  }

  fecharSerie() {
    this.cancelarAberturaGrafico();
    this.serieAberta.set(null);
    this.carregandoModalGrafico.set(false);
  }

  gerarPdf() {
    const series = this.series();
    const sonda = this.sondaSelecionada();
    if (!sonda || series.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.erro.set('O navegador bloqueou a janela do PDF.');
      return;
    }

    this.gerandoPdf.set(true);
    printWindow.document.write(this.htmlCarregandoPdf());
    printWindow.document.close();

    setTimeout(() => {
      const html = this.montarHtmlPdf(sonda, series);
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      let imprimiu = false;
      const imprimir = () => {
        if (imprimiu) return;
        imprimiu = true;
        printWindow.print();
      };
      printWindow.addEventListener('load', () => {
        imprimir();
        this.gerandoPdf.set(false);
      }, { once: true });

      setTimeout(imprimir, 350);
      setTimeout(() => this.gerandoPdf.set(false), 1200);
    }, 80);
  }

  private cancelarAberturaGrafico() {
    if (this.abrirSerieTimer) {
      clearTimeout(this.abrirSerieTimer);
      this.abrirSerieTimer = null;
    }
  }

  private montarHtmlPdf(sonda: SondaDisponivel, series: MonitoramentoSerie[]): string {
    const periodo = this.periodoConsultado() || this.calcularPeriodo();
    const inicio = this.formatarDataHora(periodo.inicio);
    const fim = this.formatarDataHora(periodo.fim);
    const criadoEm = this.formatarDataHora(new Date().toISOString());
    const titulo = 'Carta de operação';
    const nomeSonda = sonda.apelido || sonda.nome;
    const totalAmostras = series.reduce((total, serie) => total + serie.pontos.length, 0);
    const logoUrl = `${window.location.origin}/logo.png`;
    const paginasGraficos = series.map(serie => this.montarPaginaGraficoPdf(serie, nomeSonda, inicio, fim)).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${this.escapeHtml(titulo)} - ${this.escapeHtml(nomeSonda)}</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; background: #eef2f7; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    .pdf-page { width: 297mm; height: 210mm; page-break-after: always; background: #f8fafc; position: relative; overflow: hidden; }
    .pdf-header { height: 26mm; background: #0a244f !important; color: #fff; padding: 10mm 14mm 0; position: relative; box-shadow: inset 0 0 0 1000px #0a244f; }
    .pdf-header__brand { position: absolute; right: 14mm; top: 8mm; display: flex; align-items: center; gap: 4mm; font-size: 12px; font-weight: 700; }
    .pdf-header__brand img { max-width: 30mm; max-height: 12mm; object-fit: contain; }
    .pdf-title { margin: 0; font-size: 22px; line-height: 1.1; font-weight: 800; }
    .pdf-subtitle { margin-top: 4mm; color: #d6e2ff; font-size: 12px; }
    .summary-box { position: absolute; left: 16mm; right: 16mm; top: 44mm; height: 46mm; background: #fff; border: 1px solid #cbd5e1; padding: 10mm; }
    .summary-row { font-size: 13px; margin-bottom: 7mm; }
    .info-box { position: absolute; left: 16mm; right: 16mm; top: 104mm; height: 34mm; background: #eaf4ff; border: 1px solid #528c9c; padding: 8mm 10mm; }
    .info-box h2 { margin: 0 0 6mm; font-size: 14px; }
    .info-box p { margin: 0 0 4mm; font-size: 12px; }
    .chart-card { position: absolute; left: 19mm; right: 19mm; top: 39mm; bottom: 27mm; background: #fff; border: 1px solid #7a8ca8; }
    .chart-title { position: absolute; left: 19mm; top: 29mm; margin: 0; font-size: 18px; font-weight: 800; color: #fff; }
    .chart-period { position: absolute; left: 19mm; top: 37mm; color: #d6e2ff; font-size: 10px; }
    .chart-label { position: absolute; left: 23mm; top: 34mm; font-size: 13px; font-weight: 700; color: #111827; }
    .chart-variable { position: absolute; left: 23mm; top: 42mm; color: #334155; font-size: 10px; }
    .chart-svg { position: absolute; left: 23mm; right: 23mm; top: 51mm; width: 251mm; height: 117mm; }
    .legend { position: absolute; right: 24mm; bottom: 34mm; background: #fff; border: 1px solid #cbd5e1; padding: 3mm 4mm; display: flex; gap: 9mm; font-size: 9px; }
    .legend span { display: inline-flex; align-items: center; gap: 2mm; }
    .legend i { width: 10mm; height: 0; border-top: 2px solid; display: inline-block; }
    .legend .original { border-color: #00339e; }
    .legend .media { border-color: #ed4f0a; }
    .page-number { position: absolute; right: 14mm; bottom: 9mm; color: #475569; font-size: 9px; }
    .no-data { position: absolute; left: 0; right: 0; top: 83mm; text-align: center; color: #64748b; font-size: 14px; }
    @media print {
      html, body, .pdf-page, .pdf-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { background: #fff; }
      .pdf-page { page-break-after: always; }
      .pdf-header { background: #0a244f !important; box-shadow: inset 0 0 0 1000px #0a244f; }
    }
  </style>
</head>
<body>
  <section class="pdf-page">
    <div class="pdf-header">
      <div class="pdf-header__brand"><img src="${logoUrl}" alt="">Geopetro IO - Sonda</div>
      <h1 class="pdf-title">${this.escapeHtml(titulo)}</h1>
      <div class="pdf-subtitle">Monitoramento de telemetria</div>
    </div>
    <div class="summary-box">
      <div class="summary-row"><strong>Poço:</strong> ${this.escapeHtml(nomeSonda)}</div>
      <div class="summary-row"><strong>Período:</strong> ${inicio} até ${fim}</div>
      <div class="summary-row"><strong>Criado em:</strong> ${criadoEm}</div>
      <div class="summary-row"><strong>Amostras de sonda:</strong> ${totalAmostras} &nbsp; | &nbsp; <strong>Gráficos:</strong> ${series.length}</div>
    </div>
    <div class="info-box">
      <h2>Layout do PDF</h2>
      <p>Resumo na primeira página e um gráfico por página para melhorar a leitura.</p>
      <p>Linha azul: valores originais. Linha laranja: média móvel para tendência.</p>
    </div>
    <div class="page-number">Página 1 de ${series.length + 1}</div>
  </section>
  ${paginasGraficos}
</body>
</html>`;
  }

  private montarPaginaGraficoPdf(serie: MonitoramentoSerie, nomeSonda: string, inicio: string, fim: string): string {
    const pageNumber = this.series().findIndex(item => item.dispositivoId === serie.dispositivoId) + 2;
    const totalPages = this.series().length + 1;
    const titulo = this.rotuloDispositivo(serie.dispositivoId);
    const unit = this.unidadeDispositivo(serie.dispositivoId);
    const svg = this.montarSvgGraficoPdf(serie, unit);

    return `<section class="pdf-page">
    <div class="pdf-header">
      <div class="pdf-header__brand">Geopetro IO - Sonda</div>
      <h1 class="chart-title">${this.escapeHtml(titulo)}</h1>
      <div class="chart-period">${this.escapeHtml(nomeSonda)} | ${inicio} até ${fim}</div>
    </div>
    <div class="chart-card"></div>
    <div class="chart-label">${this.escapeHtml(titulo)}</div>
    <div class="chart-variable">Variável: ${this.escapeHtml(titulo)} (${this.escapeHtml(unit)})</div>
    ${svg}
    <div class="legend">
      <span><i class="original"></i>Valores originais</span>
      <span><i class="media"></i>Média móvel</span>
    </div>
    <div class="page-number">Página ${pageNumber} de ${totalPages}</div>
  </section>`;
  }

  private montarSvgGraficoPdf(serie: MonitoramentoSerie, unit: string): string {
    const pontos = serie.pontos;
    if (pontos.length === 0) {
      return '<div class="no-data">Sem dados para exibir.</div>';
    }

    const width = 950;
    const height = 430;
    const left = 78;
    const top = 34;
    const plotWidth = 820;
    const plotHeight = 322;
    const valores = pontos.map(p => p.valor);
    const min = Math.min(...valores);
    const maxOriginal = Math.max(...valores);
    const max = Math.abs(maxOriginal - min) < 0.000001 ? min + 1 : maxOriginal;
    const toX = (i: number) => pontos.length === 1 ? left : left + (plotWidth * i) / (pontos.length - 1);
    const toY = (v: number) => top + plotHeight - ((v - min) / (max - min)) * plotHeight;
    const original = valores.map((v, i) => `${toX(i).toFixed(2)},${toY(v).toFixed(2)}`).join(' ');
    const curvaSuavizada = this.montarCurvaSuavizadaPdf(this.suavizarValoresPdf(valores), toX, toY);
    const yTicks = Array.from({ length: 6 }, (_, i) => {
      const ratio = i / 5;
      const y = top + plotHeight - plotHeight * ratio;
      const valor = min + (max - min) * ratio;
      return `<line x1="${left}" x2="${left + plotWidth}" y1="${y.toFixed(2)}" y2="${y.toFixed(2)}" stroke="${i === 0 ? '#38465d' : '#dbe3ee'}" stroke-width="${i === 0 ? 1.2 : 0.7}" />
        <text x="${left - 10}" y="${(y + 3).toFixed(2)}" text-anchor="end" font-size="10" fill="#1f2937">${this.formatarValorEixo(valor)} ${this.escapeHtml(unit)}</text>`;
    }).join('');
    const xTicks = this.ticksTempo(pontos).map(tick => {
      const x = toX(tick.index);
      return `<line x1="${x.toFixed(2)}" x2="${x.toFixed(2)}" y1="${top}" y2="${top + plotHeight}" stroke="#dbe3ee" stroke-width="0.7" />
        <text x="${(x - 18).toFixed(2)}" y="${top + plotHeight + 28}" font-size="10" fill="#1f2937">${tick.label}</text>`;
    }).join('');

    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <text x="${width - 76}" y="16" font-size="10" fill="#334155">Eixo X: hora</text>
      <text x="${left - 70}" y="${top + 18}" font-size="10" fill="#334155">Eixo Y: ${this.escapeHtml(unit)}</text>
      ${yTicks}
      ${xTicks}
      <line x1="${left}" x2="${left + plotWidth}" y1="${top + plotHeight}" y2="${top + plotHeight}" stroke="#38465d" stroke-width="1.2" />
      <line x1="${left}" x2="${left}" y1="${top}" y2="${top + plotHeight}" stroke="#38465d" stroke-width="1.2" />
      <polyline points="${original}" fill="none" stroke="#00339e" stroke-width="2.2" stroke-linejoin="round" />
      <path d="${curvaSuavizada}" fill="none" stroke="#ed4f0a" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round" />
    </svg>`;
  }

  private htmlCarregandoPdf(): string {
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Preparando PDF</title>
      <style>
        body { margin: 0; height: 100vh; display: grid; place-items: center; font-family: Arial, Helvetica, sans-serif; color: #334155; background: #f8fafc; }
        .box { text-align: center; }
        .spin { width: 42px; height: 42px; margin: 0 auto 16px; border: 4px solid #dbe3ee; border-top-color: #528c9c; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style></head><body><div class="box"><div class="spin"></div><p>Preparando PDF...</p></div></body></html>`;
  }

  private suavizarValoresPdf(valores: number[]): number[] {
    if (valores.length < 3) return valores;

    const janelaBase = Math.max(5, Math.round(valores.length * 0.045));
    const janela = Math.min(17, janelaBase % 2 === 0 ? janelaBase + 1 : janelaBase);
    const raio = Math.floor(janela / 2);
    let suavizados = valores;

    for (let passagem = 0; passagem < 2; passagem++) {
      suavizados = suavizados.map((_valor, index) => {
        const inicio = Math.max(0, index - raio);
        const fim = Math.min(suavizados.length - 1, index + raio);
        const trecho = suavizados.slice(inicio, fim + 1);
        return trecho.reduce((total, valor) => total + valor, 0) / trecho.length;
      });
    }

    return suavizados;
  }

  private montarCurvaSuavizadaPdf(
    valores: number[],
    toX: (index: number) => number,
    toY: (valor: number) => number
  ): string {
    const pontos = valores.map((valor, index) => ({ x: toX(index), y: toY(valor) }));
    if (pontos.length === 0) return '';
    if (pontos.length === 1) return `M ${pontos[0].x.toFixed(2)} ${pontos[0].y.toFixed(2)}`;

    let path = `M ${pontos[0].x.toFixed(2)} ${pontos[0].y.toFixed(2)}`;
    for (let i = 1; i < pontos.length; i++) {
      const anterior = pontos[i - 1];
      const atual = pontos[i];
      const meioX = (anterior.x + atual.x) / 2;
      const meioY = (anterior.y + atual.y) / 2;
      path += ` Q ${anterior.x.toFixed(2)} ${anterior.y.toFixed(2)} ${meioX.toFixed(2)} ${meioY.toFixed(2)}`;
    }

    const ultimo = pontos[pontos.length - 1];
    path += ` T ${ultimo.x.toFixed(2)} ${ultimo.y.toFixed(2)}`;
    return path;
  }

  private ticksTempo(pontos: MonitoramentoSerie['pontos']): { index: number; label: string }[] {
    const total = Math.min(6, Math.max(2, pontos.length));
    return Array.from({ length: total }, (_, i) => {
      const index = total === 1 ? 0 : Math.round((pontos.length - 1) * (i / (total - 1)));
      return { index, label: this.formatarHora(pontos[index]?.dataHora) };
    });
  }

  private unidadeDispositivo(dispositivoId: string): string {
    const unidades: Record<string, string> = {
      VAZAO_01: 'bbl/min',
      PESO_COLUNA_01: 'lbf',
      TORQUE_01: 'lbf.ft',
      TORQUE_02: 'lbf.ft',
      PRESSAO_01: 'psi',
    };
    return unidades[dispositivoId] || '';
  }

  private formatarDataHora(valor: string): string {
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return valor;
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private formatarHora(valor?: string): string {
    if (!valor) return '';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private formatarValorEixo(valor: number): string {
    const absoluto = Math.abs(valor);
    if (absoluto >= 100) return valor.toFixed(0);
    if (absoluto >= 10) return valor.toFixed(1);
    return valor.toFixed(2);
  }

  private escapeHtml(valor: string): string {
    return valor
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
