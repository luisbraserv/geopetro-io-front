import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { SqueezeHydraulicSimulation } from '../../models/squeeze.model';

Chart.register(...registerables);

@Component({
  selector: 'app-squeeze-operation-charts',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (data) {
      <div class="sq-charts">
        <div class="sq-block">
          <div class="sq-block-head">
            <div>
              <div class="sq-title">Envelope de Pressão — Zona de Squeeze</div>
              <div class="sq-sub">Pressões calculadas na profundidade dos canhoneados</div>
            </div>
            <button class="save-btn" type="button" (click)="saveChart(envelope, 'squeeze-envelope-pressao')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Salvar
            </button>
          </div>
          <canvas #envelope></canvas>
        </div>
        <div class="sq-block">
          <div class="sq-block-head">
            <div>
              <div class="sq-title">Pressão e Deslocamento x Tempo — Squeeze</div>
              <div class="sq-sub">Volume acumulado, superfície, hidrostática, fricção, poro e fratura</div>
            </div>
            <button class="save-btn" type="button" (click)="saveChart(pressureTime, 'squeeze-pressao-tempo')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Salvar
            </button>
          </div>
          <canvas #pressureTime></canvas>
        </div>
        <div class="sq-block">
          <div class="sq-block-head">
            <div>
              <div class="sq-title">BHP e ECD — Squeeze</div>
              <div class="sq-sub">Referência na zona canhoneada</div>
            </div>
            <button class="save-btn" type="button" (click)="saveChart(bhpEcd, 'squeeze-bhp-ecd')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Salvar
            </button>
          </div>
          <canvas #bhpEcd></canvas>
        </div>
        <div class="sq-block">
          <div class="sq-block-head">
            <div>
              <div class="sq-title">Free Fall / Tubo em U — Squeeze</div>
              <div class="sq-sub">Vazão bombeada, vazão real estimada, pressão motriz e perdas</div>
            </div>
            <button class="save-btn" type="button" (click)="saveChart(freeFall, 'squeeze-free-fall')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Salvar
            </button>
          </div>
          <canvas #freeFall></canvas>
        </div>
        <div class="sq-block">
          <div class="sq-title">Índice Operacional Estimado — Squeeze</div>
          <div class="op-index">{{ data.summary.operationalIndex }}%</div>
          <div class="sq-sub">Índice heurístico operacional; não representa CFD nem eficiência física real.</div>
        </div>
      </div>
    }
  `,
  styles: [`
    .sq-charts { display: flex; flex-direction: column; gap: 16px; }
    .sq-block { padding: 16px; border: 1px solid var(--color-card-border); border-radius: 8px; background: var(--color-card); }
    .sq-block-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
    .sq-title { color: var(--color-text-strong); font-size: .92rem; font-weight: 850; }
    .sq-sub { margin: 3px 0 0; color: var(--color-text-body); font-size: .74rem; }
    canvas { width: 100%; height: 340px; }
    .op-index { color: var(--color-primary); font-size: 42px; font-weight: 900; line-height: 1; }
    .save-btn { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; padding: 5px 10px; border: 1px solid var(--color-card-border, #e2e8f0); border-radius: 6px; background: #f8fafc; color: var(--color-text-body, #64748b); font: inherit; font-size: .72rem; font-weight: 650; cursor: pointer; transition: background .15s, color .15s; }
    .save-btn:hover { background: #eef6ff; color: var(--color-primary, #4291e1); border-color: rgba(66,145,225,.3); }
  `],
})
export class SqueezeOperationChartsComponent implements AfterViewInit, OnChanges {
  @Input() data: SqueezeHydraulicSimulation | null = null;
  @ViewChild('envelope') envelope!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pressureTime') pressureTime!: ElementRef<HTMLCanvasElement>;
  @ViewChild('bhpEcd') bhpEcd!: ElementRef<HTMLCanvasElement>;
  @ViewChild('freeFall') freeFall!: ElementRef<HTMLCanvasElement>;
  private charts: Chart[] = [];

  ngAfterViewInit(): void { this.build(); }
  ngOnChanges(): void { this.destroy(); queueMicrotask(() => this.build()); }

  saveChart(canvas: HTMLCanvasElement, filename: string): void {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.png`;
    a.click();
  }

  private build(): void {
    if (!this.data || !this.envelope || !this.pressureTime || !this.bhpEcd || !this.freeFall) return;
    const pts = this.data.points;
    const labels = pts.map(p => p.timeMin.toFixed(1));
    this.charts.push(this.line(this.envelope, labels, [
      ['Poro', pts.map(p => p.porePsi), '#10b981'],
      ['Fratura', pts.map(p => p.fracturePsi), '#ef4444'],
      ['BHP squeeze', pts.map(p => p.bhpPsi), '#f97316'],
      ['Pressão sup.', pts.map(p => p.surfacePressurePsi), '#577ca1'],
      ['Hidrostática', pts.map(p => p.hydrostaticPsi), '#8b7857'],
      ['Fricção', pts.map(p => p.frictionPsi), '#e0a541'],
    ], 'Pressão (psi)', false, 'Tempo (min)'));
    this.charts.push(this.line(this.pressureTime, labels, [
      ['Volume acumulado (bbl)', pts.map(p => p.pumpedVolumeBbl), '#4291e1', 'y1'],
      ['Pressão sup. (psi)', pts.map(p => p.surfacePressurePsi), '#577ca1'],
      ['BHP squeeze (psi)', pts.map(p => p.bhpPsi), '#f97316'],
      ['Hidrostática (psi)', pts.map(p => p.hydrostaticPsi), '#8b7857'],
      ['Fricção (psi)', pts.map(p => p.frictionPsi), '#e0a541'],
      ['Poro (psi)', pts.map(p => p.porePsi), '#10b981'],
      ['Fratura (psi)', pts.map(p => p.fracturePsi), '#ef4444'],
    ], 'Pressão (psi)', true));
    this.charts.push(this.line(this.bhpEcd, labels, [
      ['BHP (psi)', pts.map(p => p.bhpPsi), '#f97316'],
      ['ECD (ppg)', pts.map(p => p.ecdPpg ?? 0), '#4291e1', 'y1'],
      ['Grad. poro equiv. (ppg)', pts.map(() => this.data!.summary.porePsi / (0.1706 * this.data!.summary.referenceTVD)), '#10b981', 'y1'],
      ['Grad. fratura equiv. (ppg)', pts.map(() => this.data!.summary.fracturePsi / (0.1706 * this.data!.summary.referenceTVD)), '#ef4444', 'y1'],
    ], 'BHP (psi)', true));
    this.charts.push(this.line(this.freeFall, labels, [
      ['Vazão bombeada', pts.map(p => p.programmedRateBpm), '#4291e1', 'y1'],
      ['Vazão real estimada', pts.map(p => p.realRateBpm), '#e0a541', 'y1'],
      ['Vazão adicional free fall', pts.map(p => p.freeFallExtraRateBpm), '#ef4444', 'y1'],
      ['Drive hidrostático (psi)', pts.map(p => p.drivePsi), '#577ca1'],
      ['Perda hidráulica (psi)', pts.map(p => p.hydraulicLossPsi), '#8b7857'],
      ['Volume free fall (bbl)', pts.map(p => p.freeFallAccumBbl), '#9333ea', 'y1'],
    ], 'Pressão (psi)', true));
  }

  private line(
    ref: ElementRef<HTMLCanvasElement>,
    labels: string[],
    datasets: Array<[string, Array<number | null>, string, string?]>,
    yTitle: string,
    dualAxis = false,
    xTitle?: string,
  ): Chart {
    return new Chart(ref.nativeElement.getContext('2d')!, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map(([label, data, color, axis]) => ({
          label,
          data,
          yAxisID: axis || 'y',
          borderColor: color,
          backgroundColor: 'transparent',
          pointRadius: labels.length === 1 ? 4 : 0,
          tension: .2,
          borderWidth: 2,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { title: { display: true, text: xTitle || (labels.length === 1 ? 'Zona canhoneada' : 'Tempo (min)') } },
          y: { title: { display: true, text: yTitle } },
          ...(dualAxis ? { y1: { position: 'right', grid: { drawOnChartArea: false } } } : {}),
        },
      },
    } as ChartConfiguration);
  }

  private destroy(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
  }
}
