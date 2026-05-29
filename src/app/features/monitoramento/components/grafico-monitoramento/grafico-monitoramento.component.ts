import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonitoramentoSerie } from '../../services/monitoramento-sonda.service';

@Component({
  selector: 'app-grafico-monitoramento',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="grafico-card">
      <header class="grafico-header">
        <div>
          <span class="grafico-title">{{ titulo || serie.dispositivoId }}</span>
          <span class="grafico-meta">{{ serie.pontos.length }} pontos</span>
        </div>

        <div class="line-controls">
          <label>
            <input type="checkbox" [checked]="mostrarOriginal()" (change)="mostrarOriginal.set($any($event.target).checked)" />
            <span>Original</span>
          </label>
          <label>
            <input type="checkbox" [checked]="mostrarSuavizada()" (change)="mostrarSuavizada.set($any($event.target).checked)" />
            <span>Suavizada</span>
          </label>
        </div>
      </header>

      <div class="grafico-area">
        <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="grafico-svg" preserveAspectRatio="none">
          @for (linha of gridLinhas(); track linha.y) {
            <line [attr.x1]="pad" [attr.x2]="W - pad" [attr.y1]="linha.y" [attr.y2]="linha.y"
                  stroke="#e2e8f0" stroke-width="1" />
            <text [attr.x]="pad - 8" [attr.y]="linha.y + 4" text-anchor="end"
                  font-size="10" fill="#64748b">{{ linha.label }}</text>
          }

          @for (linha of gridX(); track linha.x) {
            <line [attr.x1]="linha.x" [attr.x2]="linha.x" [attr.y1]="pad" [attr.y2]="H - pad"
                  stroke="#f1f5f9" stroke-width="1" />
          }

          <line [attr.x1]="pad" [attr.x2]="W - pad" [attr.y1]="H - pad" [attr.y2]="H - pad" stroke="#334155" stroke-width="1" />
          <line [attr.x1]="pad" [attr.x2]="pad" [attr.y1]="pad" [attr.y2]="H - pad" stroke="#334155" stroke-width="1" />

          @if (mostrarOriginal()) {
            <polygon [attr.points]="areaOriginalSvg()" fill="rgba(37,99,235,0.08)" />
            <polyline [attr.points]="originalSvg()" fill="none" stroke="#1d4ed8" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          }

          @if (mostrarSuavizada()) {
            <polyline [attr.points]="suavizadaSvg()" fill="none" stroke="#f97316" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
          }

          <text [attr.x]="pad" y="22" font-size="11" fill="#475569">Variavel: {{ titulo || serie.dispositivoId }}{{ unidade ? ' (' + unidade + ')' : '' }}</text>
          <text [attr.x]="W - pad" [attr.y]="H - 12" text-anchor="end" font-size="10" fill="#64748b">Eixo X: hora</text>
          <text [attr.x]="pad + 8" [attr.y]="pad + 14" font-size="10" fill="#64748b">Eixo Y{{ unidade ? ': ' + unidade : '' }}</text>
        </svg>

        <div class="eixo-x">
          @for (label of labelsX(); track label) {
            <span>{{ label }}</span>
          }
        </div>
      </div>
    </article>
  `,
  styles: [`
    .grafico-card {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      min-height: 360px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem;
      box-shadow: var(--shadow-card);
    }
    .grafico-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }
    .grafico-header > div:first-child {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .grafico-title { font-size: 0.92rem; font-weight: 800; color: var(--color-text-strong); }
    .grafico-meta { font-size: 0.75rem; color: var(--color-text-secondary); }
    .line-controls {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.55rem;
    }
    .line-controls label {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: #334155;
      font-size: 0.76rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .line-controls input {
      width: 0.9rem;
      height: 0.9rem;
      accent-color: #2563eb;
    }
    .grafico-area { position: relative; flex: 1; min-height: 0; }
    .grafico-svg { width: 100%; height: 300px; display: block; }
    .eixo-x {
      display: flex;
      justify-content: space-between;
      padding: 0 48px;
      font-size: 0.7rem;
      color: #64748b;
    }
  `],
})
export class GraficoMonitoramentoComponent {
  @Input({ required: true }) serie!: MonitoramentoSerie;
  @Input() titulo = '';
  @Input() unidade = '';

  readonly mostrarOriginal = signal(true);
  readonly mostrarSuavizada = signal(true);

  readonly W = 800;
  readonly H = 300;
  readonly pad = 48;

  get valores(): number[] { return this.serie.pontos.map((p) => Number(p.valor ?? 0)); }
  get minV(): number { return Math.min(...this.valores); }
  get maxV(): number { return Math.max(...this.valores); }
  get rangeV(): number { return this.maxV - this.minV || 1; }

  toX(i: number): number {
    const n = this.serie.pontos.length;
    if (n < 2) return this.pad;
    return this.pad + (i / (n - 1)) * (this.W - this.pad * 2);
  }

  toY(v: number): number {
    return this.H - this.pad - ((v - this.minV) / this.rangeV) * (this.H - this.pad * 2);
  }

  originalSvg(): string {
    return this.serie.pontos.map((p, i) => `${this.toX(i)},${this.toY(Number(p.valor ?? 0))}`).join(' ');
  }

  suavizadaSvg(): string {
    return this.mediaMovel(this.valores, 8).map((valor, i) => `${this.toX(i)},${this.toY(valor)}`).join(' ');
  }

  areaOriginalSvg(): string {
    const linha = this.originalSvg();
    const n = this.serie.pontos.length - 1;
    return `${this.pad},${this.H - this.pad} ${linha} ${this.toX(n)},${this.H - this.pad}`;
  }

  gridLinhas(): { y: number; label: string }[] {
    const steps = 5;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const v = this.minV + (this.rangeV * i) / steps;
      return { y: this.toY(v), label: this.formatarValor(v) };
    });
  }

  gridX(): { x: number }[] {
    return this.indicesLabelsX().map((i) => ({ x: this.toX(i) }));
  }

  labelsX(): string[] {
    return this.indicesLabelsX().map((i) => {
      const d = new Date(this.serie.pontos[i].dataHora);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    });
  }

  private indicesLabelsX(): number[] {
    const pts = this.serie.pontos;
    if (pts.length < 2) return [];
    return [
      0,
      Math.floor(pts.length / 4),
      Math.floor(pts.length / 2),
      Math.floor((3 * pts.length) / 4),
      pts.length - 1,
    ];
  }

  private mediaMovel(values: number[], window: number): number[] {
    return values.map((_, i) => {
      const start = Math.max(0, i - window + 1);
      const slice = values.slice(start, i + 1);
      return slice.reduce((sum, value) => sum + value, 0) / slice.length;
    });
  }

  private formatarValor(value: number): string {
    if (Math.abs(value) >= 100) return value.toFixed(0);
    if (Math.abs(value) >= 10) return value.toFixed(1);
    return value.toFixed(2);
  }
}
