import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonitoramentoSerie } from '../../services/monitoramento-sonda.service';

@Component({
  selector: 'app-grafico-monitoramento',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grafico-wrapper">
      <div class="grafico-header">
        <span class="grafico-title">{{ serie.dispositivoId }}</span>
        <span class="grafico-meta">{{ serie.pontos.length }} pontos</span>
      </div>
      <div class="grafico-area">
        <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="grafico-svg" preserveAspectRatio="none">
          @for (linha of gridLinhas(); track linha.y) {
            <line [attr.x1]="pad" [attr.x2]="W - pad" [attr.y1]="linha.y" [attr.y2]="linha.y"
                  stroke="#e2e8f0" stroke-width="1" />
            <text [attr.x]="pad - 6" [attr.y]="linha.y + 4" text-anchor="end"
                  font-size="10" fill="#94a3b8">{{ linha.label }}</text>
          }
          <polygon [attr.points]="areasSvg()" fill="rgba(82,140,156,0.08)" />
          <polyline [attr.points]="pontosSvg()" fill="none" stroke="rgba(82,140,156,1)" stroke-width="2" stroke-linejoin="round" />
        </svg>
        <div class="eixo-x">
          @for (label of labelsX(); track label) {
            <span>{{ label }}</span>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .grafico-wrapper { display: flex; flex-direction: column; gap: 0.5rem; height: 100%; }
    .grafico-header { display: flex; justify-content: space-between; align-items: center; }
    .grafico-title { font-size: 0.9rem; font-weight: 700; color: var(--color-text-strong); }
    .grafico-meta { font-size: 0.75rem; color: var(--color-text-secondary); }
    .grafico-area { position: relative; flex: 1; }
    .grafico-svg { width: 100%; height: 300px; display: block; }
    .eixo-x { display: flex; justify-content: space-between; padding: 0 48px; font-size: 0.7rem; color: #94a3b8; }
  `],
})
export class GraficoMonitoramentoComponent {
  @Input({ required: true }) serie!: MonitoramentoSerie;

  readonly W = 800;
  readonly H = 300;
  readonly pad = 48;

  get valores(): number[] { return this.serie.pontos.map(p => p.valor); }
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

  pontosSvg(): string {
    return this.serie.pontos.map((p, i) => `${this.toX(i)},${this.toY(p.valor)}`).join(' ');
  }

  areasSvg(): string {
    const linha = this.serie.pontos.map((p, i) => `${this.toX(i)},${this.toY(p.valor)}`).join(' ');
    const n = this.serie.pontos.length - 1;
    return `${this.pad},${this.H - this.pad} ${linha} ${this.toX(n)},${this.H - this.pad}`;
  }

  gridLinhas(): { y: number; label: string }[] {
    const steps = 5;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const v = this.minV + (this.rangeV * i) / steps;
      return { y: this.toY(v), label: v.toFixed(1) };
    });
  }

  labelsX(): string[] {
    const pts = this.serie.pontos;
    if (pts.length < 2) return [];
    const indices = [
      0,
      Math.floor(pts.length / 4),
      Math.floor(pts.length / 2),
      Math.floor((3 * pts.length) / 4),
      pts.length - 1,
    ];
    return indices.map(i => {
      const d = new Date(pts[i].dataHora);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
  }
}
