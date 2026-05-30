import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonitoramentoSerie } from '../../services/monitoramento-sonda.service';

@Component({
  selector: 'app-grafico-monitoramento',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grafico-wrapper">
      <div class="grafico-header">
        <div>
          <span class="grafico-title">{{ titulo || serie.dispositivoId }}</span>
          <div class="grafico-legenda">
            <span><i class="legenda-original"></i> Original</span>
            <span><i class="legenda-suavizada"></i> Suavizada</span>
          </div>
        </div>
        <div class="grafico-actions">
          <span class="grafico-meta">{{ serie.pontos.length }} pontos</span>
          @if (mostrarAbrir) {
            <button type="button" class="abrir-btn" (click)="abrir.emit()">Abrir</button>
          }
        </div>
      </div>
      <div class="grafico-area">
        <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="grafico-svg" preserveAspectRatio="none">
          @for (linha of gridLinhas; track linha.y) {
            <line [attr.x1]="pad" [attr.x2]="W - pad" [attr.y1]="linha.y" [attr.y2]="linha.y"
                  stroke="#e2e8f0" stroke-width="1" />
            <text [attr.x]="pad - 6" [attr.y]="linha.y + 4" text-anchor="end"
                  font-size="10" fill="#94a3b8">{{ linha.label }}</text>
          }
          <polygon [attr.points]="areaSvg" fill="rgba(82,140,156,0.08)" />
          <polyline [attr.points]="pontosOriginaisSvg" fill="none" stroke="rgba(82,140,156,0.42)"
                    stroke-width="1.7" stroke-linejoin="round" />
          <path [attr.d]="curvaSuavizadaSvg" fill="none" stroke="#c2410c"
                stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
        <div class="eixo-x">
          @for (label of labelsX; track label) {
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
    .grafico-actions { display: inline-flex; align-items: center; gap: 0.6rem; }
    .abrir-btn {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      color: #1f2937;
      cursor: pointer;
      font: inherit;
      font-size: 0.72rem;
      font-weight: 700;
      height: 1.8rem;
      padding: 0 0.55rem;
    }
    .abrir-btn:hover { border-color: rgba(82, 140, 156, 0.72); color: rgb(55, 107, 122); }
    .grafico-legenda { display: flex; gap: 0.7rem; margin-top: 0.25rem; font-size: 0.68rem; color: var(--color-text-secondary); }
    .grafico-legenda span { display: inline-flex; align-items: center; gap: 0.28rem; }
    .grafico-legenda i { width: 18px; height: 3px; border-radius: 999px; display: inline-block; }
    .legenda-original { background: rgba(82,140,156,0.42); }
    .legenda-suavizada { background: #c2410c; }
    .grafico-area { position: relative; flex: 1; }
    .grafico-svg { width: 100%; height: 300px; display: block; }
    .eixo-x { display: flex; justify-content: space-between; padding: 0 48px; font-size: 0.7rem; color: #94a3b8; }
  `],
})
export class GraficoMonitoramentoComponent implements OnChanges {
  @Input({ required: true }) serie!: MonitoramentoSerie;
  @Input() titulo = '';
  @Input() mostrarAbrir = true;
  @Output() abrir = new EventEmitter<void>();

  readonly W = 800;
  readonly H = 300;
  readonly pad = 48;

  pontosOriginaisSvg = '';
  curvaSuavizadaSvg = '';
  areaSvg = '';
  gridLinhas: { y: number; label: string }[] = [];
  labelsX: string[] = [];

  private valores: number[] = [];
  private minV = 0;
  private rangeV = 1;

  ngOnChanges() {
    this.prepararGrafico();
  }

  toX(i: number): number {
    const n = this.serie.pontos.length;
    if (n < 2) return this.pad;
    return this.pad + (i / (n - 1)) * (this.W - this.pad * 2);
  }

  toY(v: number): number {
    return this.H - this.pad - ((v - this.minV) / this.rangeV) * (this.H - this.pad * 2);
  }

  pontosSvg(valores: number[]): string {
    return valores.map((v, i) => `${this.toX(i)},${this.toY(v)}`).join(' ');
  }

  private prepararGrafico() {
    this.valores = this.serie.pontos.map(p => p.valor);
    if (this.valores.length === 0) {
      this.minV = 0;
      this.rangeV = 1;
      this.pontosOriginaisSvg = '';
      this.curvaSuavizadaSvg = '';
      this.areaSvg = '';
      this.gridLinhas = [];
      this.labelsX = [];
      return;
    }

    this.minV = Math.min(...this.valores);
    const maxV = Math.max(...this.valores);
    this.rangeV = maxV - this.minV || 1;
    this.pontosOriginaisSvg = this.pontosSvg(this.valores);
    this.curvaSuavizadaSvg = this.montarCurvaSuavizadaSvg();
    this.areaSvg = this.montarAreaSvg();
    this.gridLinhas = this.montarGridLinhas();
    this.labelsX = this.montarLabelsX();
  }

  private montarCurvaSuavizadaSvg(): string {
    const pontos = this.valoresSuavizados().map((v, i) => ({ x: this.toX(i), y: this.toY(v) }));
    if (pontos.length === 0) return '';
    if (pontos.length === 1) return `M ${pontos[0].x} ${pontos[0].y}`;

    let path = `M ${pontos[0].x} ${pontos[0].y}`;
    for (let i = 1; i < pontos.length; i++) {
      const anterior = pontos[i - 1];
      const atual = pontos[i];
      const meioX = (anterior.x + atual.x) / 2;
      const meioY = (anterior.y + atual.y) / 2;
      path += ` Q ${anterior.x} ${anterior.y} ${meioX} ${meioY}`;
    }

    const ultimo = pontos[pontos.length - 1];
    path += ` T ${ultimo.x} ${ultimo.y}`;
    return path;
  }

  private montarAreaSvg(): string {
    const linha = this.serie.pontos.map((p, i) => `${this.toX(i)},${this.toY(p.valor)}`).join(' ');
    const n = this.serie.pontos.length - 1;
    return `${this.pad},${this.H - this.pad} ${linha} ${this.toX(n)},${this.H - this.pad}`;
  }

  private montarGridLinhas(): { y: number; label: string }[] {
    const steps = 5;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const v = this.minV + (this.rangeV * i) / steps;
      return { y: this.toY(v), label: v.toFixed(1) };
    });
  }

  private montarLabelsX(): string[] {
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

  private valoresSuavizados(): number[] {
    const valores = this.valores;
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
        return trecho.reduce((total, atual) => total + atual, 0) / trecho.length;
      });
    }

    return suavizados;
  }
}
