import { Component, Input, OnChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

export interface OpsPhase {
  label: string;
  durationMin: number;
  color: string;
}

@Component({
  selector: 'app-ops-chart',
  standalone: true,
  template: `
    <div class="chart-wrap" [class.zoom-active]="useOperationalZoom()">
      <div class="chart-toolbar">
        @if (useOperationalZoom()) {
          <span
            class="zoom-badge"
            title="A linha inferior amplia visualmente o tempo de bombeio. Os valores exibidos continuam sendo reais.">
            Zoom operacional ativado
          </span>
        }
        @if (!useOperationalZoom()) {
          <button class="save-btn" type="button" (click)="save()" title="Salvar imagem">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Salvar
          </button>
        }
      </div>

      @if (useOperationalZoom()) {
        <div class="adaptive-timeline">
          <section class="timeline-section">
            <div class="timeline-head">
              <strong>Visao geral</strong>
              <span>Escala real: 0 a {{ formatMin(totalChartTimeMin()) }}</span>
            </div>
            <div class="overview-track">
              <div class="overview-pump" [style.width.%]="overviewPumpWidth()"></div>
              @for (marker of overviewMarkers(); track marker.key) {
                <div class="marker" [class]="marker.cls" [style.left.%]="marker.left">
                  <span [style.top.px]="marker.labelTop">{{ marker.label }}</span>
                </div>
              }
            </div>
            <div class="axis-row">
              <span>0 min</span>
              <span>Bombeio {{ formatMin(totalPumpTimeMin()) }}</span>
              <span>Total {{ formatMin(totalChartTimeMin()) }}</span>
            </div>
          </section>

          <section class="timeline-section zoom-section">
            <div class="timeline-head">
              <strong>Zoom operacional</strong>
              <span>Blocos ampliados; duracoes reais nos rotulos</span>
            </div>
            <div class="zoom-track">
              @for (phase of visiblePhases(); track phase.label + phase.durationMin) {
                <div class="zoom-phase" [style.flex-grow]="phase.durationMin" [style.background]="phase.color">
                  <span>{{ phase.label }}</span>
                  <small>{{ formatMin(phase.durationMin) }}</small>
                </div>
              }
            </div>
          </section>

          <div class="legend">
            @for (phase of visiblePhases(); track phase.label + phase.color) {
              <span><i [style.background]="phase.color"></i>{{ phase.label }}</span>
            }
            <span><i class="tt50"></i>TT 50Bc</span>
            <span><i class="tt100"></i>TT 100Bc</span>
          </div>
        </div>
      } @else {
        <div class="chart-box"><canvas #canvas></canvas></div>
      }
    </div>
  `,
  styles: [`
    .chart-wrap { display: flex; flex-direction: column; gap: 8px; padding-bottom: 8px; }
    .chart-toolbar { display: flex; justify-content: flex-end; align-items: center; gap: 10px; min-height: 28px; }
    .chart-box { position: relative; height: clamp(140px, 22vh, 170px); min-height: 0; }
    .chart-box canvas { display: block; width: 100% !important; height: 100% !important; }
    .zoom-active { min-height: 260px; }
    .zoom-badge { display: inline-flex; align-items: center; padding: 4px 9px; border-radius: 999px; background: #eef6ff; color: #2563eb; border: 1px solid rgba(37, 99, 235, .18); font-size: .68rem; font-weight: 750; }
    .adaptive-timeline { display: flex; flex-direction: column; gap: 14px; padding: 10px 4px 4px; }
    .timeline-section { display: flex; flex-direction: column; gap: 7px; }
    .timeline-head { display: flex; justify-content: space-between; gap: 12px; color: var(--color-text-body, #64748b); font-size: .72rem; }
    .timeline-head strong { color: var(--color-text-strong, #1e293b); font-size: .78rem; }
    .overview-track { position: relative; height: 48px; border-radius: 8px; background: #f1f5f9; border: 1px solid #e2e8f0; overflow: visible; }
    .overview-pump { position: absolute; left: 0; top: 17px; height: 14px; min-width: 2px; border-radius: 999px; background: linear-gradient(90deg, #38bdf8, #fb923c); }
    .marker { position: absolute; top: 8px; bottom: 8px; width: 0; border-left: 2px dashed currentColor; }
    .marker span { position: absolute; left: 6px; white-space: nowrap; font-size: .68rem; font-weight: 800; background: rgba(255,255,255,.92); padding: 1px 4px; border-radius: 4px; box-shadow: 0 0 0 1px rgba(226,232,240,.8); }
    .marker.tt50 { color: #ef4444; }
    .marker.tt100 { color: #7c3aed; }
    .marker.total { color: #334155; }
    .axis-row { display: flex; justify-content: space-between; color: #64748b; font-size: .68rem; }
    .zoom-track { display: flex; gap: 4px; min-height: 64px; padding: 5px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; overflow: hidden; }
    .zoom-phase { min-width: 72px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 8px; border-radius: 6px; color: #1f2937; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); text-align: center; }
    .zoom-phase span { font-size: .72rem; font-weight: 850; line-height: 1.1; overflow-wrap: anywhere; }
    .zoom-phase small { font-size: .66rem; font-weight: 750; color: rgba(15, 23, 42, .72); }
    .legend { display: flex; flex-wrap: wrap; justify-content: flex-start; align-items: center; gap: 8px 14px; padding-top: 2px; color: #475569; font-size: .69rem; }
    .legend span { display: inline-flex; align-items: center; gap: 5px; }
    .legend i { width: 12px; height: 8px; border-radius: 3px; display: inline-block; }
    .legend i.tt50 { width: 14px; height: 0; border-top: 2px dashed #ef4444; border-radius: 0; }
    .legend i.tt100 { width: 14px; height: 0; border-top: 2px dashed #7c3aed; border-radius: 0; }
    .save-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border: 1px solid var(--color-card-border, #e2e8f0); border-radius: 6px; background: #f8fafc; color: var(--color-text-body, #64748b); font: inherit; font-size: .72rem; font-weight: 650; cursor: pointer; transition: background .15s, color .15s; }
    .save-btn:hover { background: #eef6ff; color: var(--color-primary, #4291e1); border-color: rgba(66,145,225,.3); }
  `],
})
export class OpsChartComponent implements AfterViewInit, OnChanges {
  @Input() phases: OpsPhase[] = [];
  @Input() ttRequiredMin = 0;
  @Input() tt100Min = 0;
  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  ngAfterViewInit(): void { this.build(); }

  ngOnChanges(): void {
    this.destroyChart();
    queueMicrotask(() => this.build());
  }

  save(): void {
    if (!this.canvasRef) return;
    const url = this.canvasRef.nativeElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cronograma-bombeio.png';
    a.click();
  }

  shouldUseOperationalZoom(totalPumpTimeMin: number, totalChartTimeMin: number): boolean {
    return totalPumpTimeMin > 0 && totalChartTimeMin > 0 && totalPumpTimeMin / totalChartTimeMin < 0.15;
  }

  useOperationalZoom(): boolean {
    return this.shouldUseOperationalZoom(this.totalPumpTimeMin(), this.totalChartTimeMin());
  }

  visiblePhases(): OpsPhase[] {
    return (this.phases || []).filter(phase => Number.isFinite(phase.durationMin) && phase.durationMin > 0);
  }

  totalPumpTimeMin(): number {
    return this.visiblePhases().reduce((sum, phase) => sum + Math.max(0, phase.durationMin || 0), 0);
  }

  totalChartTimeMin(): number {
    return Math.max(this.totalPumpTimeMin(), this.ttRequiredMin || 0, this.tt100Min || 0, 1);
  }

  overviewPumpWidth(): number {
    return this.percent(this.totalPumpTimeMin(), this.totalChartTimeMin());
  }

  overviewMarkers(): Array<{ key: string; label: string; left: number; cls: string; labelTop: number }> {
    const total = this.totalChartTimeMin();
    const close = this.ttRequiredMin > 0 && this.tt100Min > 0 && Math.abs(this.tt100Min - this.ttRequiredMin) / total < 0.08;
    return [
      this.ttRequiredMin > 0 ? { key: 'tt50', label: `TT 50Bc ${this.formatMin(this.ttRequiredMin)}`, left: this.percent(this.ttRequiredMin, total), cls: 'tt50', labelTop: close ? 3 : 10 } : null,
      this.tt100Min > 0 ? { key: 'tt100', label: `TT 100Bc ${this.formatMin(this.tt100Min)}`, left: this.percent(this.tt100Min, total), cls: 'tt100', labelTop: close ? 23 : 25 } : null,
      { key: 'total', label: `Total ${this.formatMin(total)}`, left: 100, cls: 'total', labelTop: 10 },
    ].filter((marker): marker is { key: string; label: string; left: number; cls: string; labelTop: number } => marker !== null);
  }

  formatMin(value: number): string {
    if (!Number.isFinite(value)) return '-';
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: value < 10 ? 1 : 0, maximumFractionDigits: 1 })} min`;
  }

  private build(): void {
    if (this.useOperationalZoom() || !this.canvasRef) return;
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const datasets = this.visiblePhases().map(p => ({
      label: `${p.label} (${p.durationMin.toFixed(1)} min)`,
      data: [p.durationMin],
      backgroundColor: p.color,
      borderColor: 'rgba(0,0,0,0.12)',
      borderWidth: 1,
      borderRadius: 4,
    }));

    const ttMin = this.ttRequiredMin;
    const tt100Min = this.tt100Min;
    const xMax = this.totalChartTimeMin() * 1.08;

    const ttPlugin = {
      id: 'ttLine',
      afterDraw(chart: Chart) {
        if (!ttMin && !tt100Min) return;
        const { ctx: c, scales } = chart as any;
        const xScale = scales['x'];
        if (!xScale) return;
        const top = chart.chartArea.top;
        const bottom = chart.chartArea.bottom;
        const close = ttMin > 0 && tt100Min > 0 && Math.abs(tt100Min - ttMin) / Math.max(xMax, 1) < 0.08;
        const drawMarker = (value: number, label: string, color: string, yOffset: number) => {
          if (!value) return;
          const x = xScale.getPixelForValue(value);
          c.save();
          c.beginPath();
          c.moveTo(x, top);
          c.lineTo(x, bottom);
          c.strokeStyle = color;
          c.lineWidth = 2;
          c.setLineDash([6, 3]);
          c.stroke();
          c.setLineDash([]);
          c.fillStyle = color;
          c.font = 'bold 11px Inter,Arial';
          c.textAlign = 'center';
          c.fillText(`${label}: ${value.toFixed(0)} min`, x, top + yOffset);
          c.restore();
        };
        drawMarker(ttMin, 'TT 50Bc', '#ef4444', close ? 12 : 12);
        drawMarker(tt100Min, 'TT 100Bc', '#7c3aed', close ? 30 : 27);
      },
    };

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Cronograma'],
        datasets,
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 14, font: { size: 11 }, padding: 14 } },
          tooltip: { callbacks: { label: item => ` ${item.dataset.label}` } },
        },
        layout: { padding: { bottom: 10 } },
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            max: xMax,
            title: { display: true, text: 'Tempo acumulado (min)' },
          },
          y: { stacked: true, display: false },
        },
      },
      plugins: [ttPlugin],
    } as ChartConfiguration);
  }

  private percent(value: number, total: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
    return Math.max(0, Math.min(100, (value / total) * 100));
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = undefined;
  }
}
