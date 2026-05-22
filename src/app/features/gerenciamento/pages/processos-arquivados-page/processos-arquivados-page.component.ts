import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';

import { ToastService } from '../../../../shared/toast/toast.service';
import { Prioridade, Processo } from '../../models/processo.model';
import { ProcessoService } from '../../services/processo.service';

@Component({
  selector: 'app-processos-arquivados-page',
  imports: [CommonModule, TuiButton, TuiIcon],
  template: `
    <section class="page">
      <header class="page-hero">
        <div>
          <p class="eyebrow">Gerenciamento</p>
          <h1>Processos Arquivados</h1>
          <p class="subtitle">Processos finalizados e movidos para o arquivo.</p>
        </div>
        <button tuiButton type="button" appearance="secondary" (click)="voltar()">
          <tui-icon icon="@tui.arrow-left"></tui-icon>
          Voltar
        </button>
      </header>

      <main class="list">
        <article class="card" [ngClass]="prioridadeCardClass(processo.prioridade)" *ngFor="let processo of processos()">
          <div class="card__header">
            <span class="badge status-archived">Arquivado</span>
            <h2>{{ processo.titulo }}</h2>
            <p class="meta">
              <strong>Unidade/Sonda:</strong> {{ processo.unidadeSondaNome || '-' }} &nbsp;|&nbsp;
              <strong>Setor:</strong> {{ processo.setorNome }} &nbsp;|&nbsp;
              <strong>Responsável:</strong> {{ processo.responsavelNome || processo.responsavelUsername || 'Sem responsável' }} &nbsp;|&nbsp;
              <strong>Arquivado em:</strong> {{ formatarData(processo.atualizadoEm) }}
            </p>
          </div>

          <div class="card__body" *ngIf="processo.descricao">
            <p>{{ processo.descricao }}</p>
          </div>

          <div class="card__footer">
            <div class="card__meta">
              <span class="priority" [ngClass]="prioridadeClass(processo.prioridade)">
                <tui-icon *ngIf="processo.prioridade === 'ALTA' || processo.prioridade === 'CRITICA'" icon="@tui.triangle-alert"></tui-icon>
                {{ prioridadeLabel(processo.prioridade) }}
              </span>
              <span class="info" *ngIf="processo.centroCusto"><strong>CC:</strong> {{ processo.centroCusto }}</span>
              <span class="info" *ngIf="processo.dataInicio"><strong>Início:</strong> {{ formatarData(processo.dataInicio) }}</span>
              <span class="info" *ngIf="processo.dataFim"><strong>Fim:</strong> {{ formatarData(processo.dataFim) }}</span>
            </div>

            <div class="card__actions">
              <button tuiButton type="button" appearance="secondary" size="s" (click)="desarquivar(processo)">
                <tui-icon icon="@tui.rotate-ccw"></tui-icon>
                Desarquivar
              </button>
              <button tuiButton type="button" appearance="destructive" size="s" (click)="excluir(processo)">
                <tui-icon icon="@tui.trash-2"></tui-icon>
                Excluir
              </button>
            </div>
          </div>
        </article>

        <p class="empty" *ngIf="!processos().length && !carregando()">Nenhum processo arquivado encontrado.</p>
        <p class="empty" *ngIf="carregando()">Carregando...</p>
      </main>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 1rem; color: var(--color-text-strong); padding: 1.5rem; width: 100%; margin: 0; }
    .page-hero { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    h1 { margin: 0; font-size: 1.8rem; color: var(--color-text-strong); }
    h2 { margin: 0; font-size: 1.05rem; }
    .eyebrow { margin: 0 0 .25rem; color: var(--color-text-body); font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
    .subtitle { margin: .3rem 0 0; color: var(--color-text-body); }
    .list { display: grid; gap: .75rem; }
    .card { display: grid; gap: .7rem; padding: 1rem; border: 1px solid var(--color-card-border); border-left: 8px solid var(--color-secondary); border-radius: 8px; background: #fff; box-shadow: var(--shadow-card); }
    .card.priority-card-high { border-left-width: 12px; border-left-color: #c56a22; background: linear-gradient(90deg, #fff8ed 0%, #fff 30%); }
    .card.priority-card-critical { border-left-width: 14px; border-left-color: #b42318; background: linear-gradient(90deg, #fff4f2 0%, #fff 30%); box-shadow: 0 12px 28px rgba(180, 35, 24, .16); }
    .card__header { display: grid; gap: .35rem; }
    .meta { margin: 0; color: var(--color-text-body); font-size: .82rem; line-height: 1.6; }
    .card__body p { margin: 0; color: var(--color-text-body); white-space: pre-wrap; line-height: 1.45; }
    .card__footer { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: center; }
    .card__meta, .card__actions { display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; }
    .card__actions { margin-left: auto; justify-content: flex-end; }
    .card__actions button[tuiButton] { min-height: 34px; border-radius: 6px; font-weight: 800; }
    .card__actions button[tuiButton][appearance="secondary"] { background: #fff !important; border: 1px solid var(--color-border) !important; color: var(--color-text-primary) !important; }
    .card__actions button[tuiButton][appearance="secondary"]:hover { background: var(--color-primary-soft) !important; color: var(--color-primary-hover) !important; }
    .card__actions button[tuiButton][appearance="destructive"] { background: var(--color-error-soft) !important; border: 1px solid rgba(156, 102, 78, .34) !important; color: var(--color-error) !important; }
    .card__actions button[tuiButton][appearance="destructive"]:hover { background: var(--color-error) !important; color: #fff !important; }
    .info { color: var(--color-text-body); font-size: .82rem; }
    .badge, .priority { display: inline-flex; align-items: center; gap: .3rem; min-height: 22px; padding: 0 .55rem; border-radius: 999px; font-size: .72rem; font-weight: 800; width: fit-content; }
    .status-archived { background: var(--color-surface-muted); color: var(--color-text-body); }
    .priority { background: var(--color-surface-muted); color: var(--color-text-body); }
    .priority tui-icon { font-size: .9rem; color: currentColor; }
    .priority-high { min-height: 30px; padding: 0 .75rem; background: #fff4e5; color: #9a4b08; border: 1px solid rgba(181, 71, 8, .28); box-shadow: 0 3px 10px rgba(181, 71, 8, .12); }
    .priority-critical { min-height: 32px; padding: 0 .8rem; background: #fee4e2; color: #b42318; border: 1px solid rgba(180, 35, 24, .35); box-shadow: 0 4px 12px rgba(180, 35, 24, .18); text-transform: uppercase; }
    .empty { padding: 1.5rem; text-align: center; color: var(--color-text-body); border: 1px dashed var(--color-card-border); border-radius: 8px; background: #fff; }
    @media (max-width: 680px) { .page { padding: 1rem; } .page-hero { display: grid; } .card__actions, .card__actions button[tuiButton] { width: 100%; } }
  `],
})
export class ProcessosArquivadosPageComponent {
  private readonly processoService = inject(ProcessoService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly processos = signal<Processo[]>([]);
  protected readonly carregando = signal(true);

  constructor() {
    this.carregar();
  }

  protected voltar(): void {
    this.router.navigate(['/app/gerenciamento/processos']);
  }

  protected desarquivar(processo: Processo): void {
    this.processoService.desarquivar(processo.id).subscribe({
      next: () => {
        this.toast.success('Processo desarquivado com sucesso.');
        this.carregar();
      },
      error: (err: Error) => this.notificarErro(err),
    });
  }

  protected excluir(processo: Processo): void {
    if (!confirm(`Excluir permanentemente o processo "${processo.titulo}"?`)) return;
    this.processoService.excluir(processo.id).subscribe({
      next: () => {
        this.toast.success('Processo excluído com sucesso.');
        this.carregar();
      },
      error: (err: Error) => this.notificarErro(err),
    });
  }

  protected formatarData(data?: string | null): string {
    return data ? new Date(data).toLocaleString('pt-BR') : '-';
  }

  protected prioridadeLabel(prioridade: Prioridade): string {
    return { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' }[prioridade];
  }

  protected prioridadeClass(prioridade: Prioridade): string {
    return prioridade === 'CRITICA' ? 'priority-critical' : prioridade === 'ALTA' ? 'priority-high' : '';
  }

  protected prioridadeCardClass(prioridade: Prioridade): string {
    return prioridade === 'CRITICA' ? 'priority-card-critical' : prioridade === 'ALTA' ? 'priority-card-high' : '';
  }

  private carregar(): void {
    this.carregando.set(true);
    this.processoService.listar({ status: 'ARQUIVADO' }).subscribe({
      next: (lista) => {
        this.processos.set(lista);
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.notificarErro(err);
        this.carregando.set(false);
      },
    });
  }

  private notificarErro(err: Error): void {
    this.toast.error(err?.message || 'Não foi possível concluir a operação.');
  }
}
