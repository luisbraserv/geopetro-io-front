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
    <div class="chart-wrap">
      <div class="chart-toolbar">
        <button class="save-btn" type="button" (click)="save()" title="Salvar imagem">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Salvar
        </button>
      </div>
      <div class="chart-box"><canvas #canvas></canvas></div>
    </div>
  `,
  styles: [`
    .chart-wrap { display: flex; flex-direction: column; gap: 6px; }
    .chart-toolbar { display: flex; justify-content: flex-end; }
    .chart-box { position: relative; height: 160px; }
    .save-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border: 1px solid var(--color-card-border, #e2e8f0); border-radius: 6px; background: #f8fafc; color: var(--color-text-body, #64748b); font: inherit; font-size: .72rem; font-weight: 650; cursor: pointer; transition: background .15s, color .15s; }
    .save-btn:hover { background: #eef6ff; color: var(--color-primary, #4291e1); border-color: rgba(66,145,225,.3); }
  `],
})
export class OpsChartComponent implements AfterViewInit, OnChanges {
  @Input() phases: OpsPhase[] = [];
  @Input() ttRequiredMin = 0;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  ngAfterViewInit(): void { this.build(); }
  ngOnChanges(): void { if (this.chart) { this.chart.destroy(); this.build(); } }

  save(): void {
    const url = this.canvasRef.nativeElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cronograma-bombeio.png';
    a.click();
  }

  private build(): void {
    if (!this.canvasRef) return;
    const ctx = this.canvasRef.nativeElement.getContext('2d')!;

    const datasets = this.phases.map(p => ({
      label: `${p.label} (${p.durationMin.toFixed(1)} min)`,
      data: [p.durationMin],
      backgroundColor: p.color,
      borderColor: 'rgba(0,0,0,0.12)',
      borderWidth: 1,
      borderRadius: 4,
    }));

    const ttMin = this.ttRequiredMin;

    const ttPlugin = {
      id: 'ttLine',
      afterDraw(chart: Chart) {
        if (!ttMin) return;
        const { ctx: c, scales } = chart as any;
        const xScale = scales['x'];
        if (!xScale) return;
        const x = xScale.getPixelForValue(ttMin);
        const top = chart.chartArea.top;
        const bottom = chart.chartArea.bottom;
        c.save();
        c.beginPath();
        c.moveTo(x, top);
        c.lineTo(x, bottom);
        c.strokeStyle = '#ef4444';
        c.lineWidth = 2;
        c.setLineDash([6, 3]);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = '#ef4444';
        c.font = 'bold 11px Inter,Arial';
        c.textAlign = 'center';
        c.fillText(`TT 50Bc: ${ttMin.toFixed(0)} min`, x, top - 6);
        c.restore();
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
          legend: { position: 'bottom', labels: { boxWidth: 14, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (item) => ` ${item.dataset.label}`,
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            title: { display: true, text: 'Tempo acumulado (min)' },
          },
          y: { stacked: true, display: false },
        },
      },
      plugins: [ttPlugin],
    } as ChartConfiguration);
  }
}
