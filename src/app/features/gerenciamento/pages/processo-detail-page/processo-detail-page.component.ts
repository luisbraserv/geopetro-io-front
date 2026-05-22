import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { RichTextEditorComponent } from '../../../../shared/rich-text-editor/rich-text-editor.component';
import { ToastService } from '../../../../shared/toast/toast.service';
import { Anotacao, AnotacaoPayload, Processo, StatusProcesso } from '../../models/processo.model';
import { AnotacaoService } from '../../services/anotacao.service';
import { ProcessoService } from '../../services/processo.service';

@Component({
  selector: 'app-processo-detail-page',
  imports: [CommonModule, FormsModule, RouterLink, RichTextEditorComponent],
  template: `
    <section class="page" *ngIf="processo() as item">
      <header class="page__header">
        <div>
          <a routerLink="/app/gerenciamento/processos">Voltar</a>
          <p>Processo</p>
          <h1>{{ item.titulo }}</h1>
        </div>
        <label class="status">Status rapido
          <select [(ngModel)]="statusRapido" name="statusRapido" (ngModelChange)="alterarStatus()">
            <option *ngFor="let status of statusOptions" [value]="status">{{ statusLabel(status) }}</option>
          </select>
        </label>
      </header>

      <p class="feedback" *ngIf="feedback()">{{ feedback() }}</p>
      <p class="error" *ngIf="error()">{{ error() }}</p>

      <div class="summary">
        <article><span>Status</span><strong>{{ statusLabel(item.statusProcesso) }}</strong></article>
        <article [ngClass]="prioridadeSummaryClass(item.prioridade)"><span>Prioridade</span><strong>{{ prioridadeLabel(item.prioridade) }}</strong></article>
        <article><span>Setor</span><strong>{{ item.setorNome }}</strong></article>
        <article><span>Projeto</span><strong>{{ item.projetoNome || '-' }}</strong></article>
        <article><span>Centro de custo</span><strong>{{ item.centroCusto || '-' }}</strong></article>
        <article><span>Previsao de conclusao</span><strong>{{ formatarData(item.dataPrevisaoConclusao) }}</strong></article>
      </div>

      <section class="panel">
        <h2>Anotacoes</h2>
        <form class="form" (ngSubmit)="salvarAnotacao()">
          <label>Titulo<input name="tituloAnotacao" [(ngModel)]="anotacaoForm.titulo" required /></label>
          <label class="wide">Texto
            <app-rich-text-editor [(value)]="anotacaoForm.texto" placeholder="Digite a anotacao..." />
          </label>
          <div class="actions">
            <button type="submit">{{ editandoAnotacaoId() ? 'Atualizar anotacao' : 'Nova anotacao' }}</button>
            <button type="button" class="ghost" (click)="limparAnotacao()" *ngIf="editandoAnotacaoId()">Cancelar</button>
          </div>
        </form>

        <div class="notes">
          <article class="note" *ngFor="let anotacao of anotacoes()">
            <header>
              <div><strong>{{ anotacao.titulo }}</strong><span>{{ formatarData(anotacao.dataCriacao) }}</span></div>
              <div class="row-actions">
                <button type="button" (click)="editarAnotacao(anotacao)">Editar</button>
                <button type="button" class="danger" (click)="excluirAnotacao(anotacao)">Excluir</button>
              </div>
            </header>
            <div class="note-content" [innerHTML]="anotacao.texto"></div>
          </article>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 1rem; color: var(--color-text-strong); padding: 1.5rem; width: min(100%, 1440px); margin: 0 auto; }
    .page__header { display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
    h1 { margin: .2rem 0 0; font-size: 1.65rem; } h2 { margin: 0; font-size: 1.2rem; } p { margin: 0; color: var(--color-text-body); } a { color: var(--color-primary); text-decoration: none; }
    .status { display: grid; gap: .35rem; min-width: 190px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: .75rem; }
    .summary article, .panel, .note { background: #fff; border: 1px solid var(--color-card-border); border-radius: 8px; }
    .summary article { padding: .9rem; } .summary span, .note span { display: block; color: var(--color-text-body); font-size: .8rem; } .summary strong { color: var(--color-text-strong); }
    .summary .priority-summary-high { border-color: rgba(181, 71, 8, .32); background: #fff8ed; }
    .summary .priority-summary-critical { border-color: rgba(180, 35, 24, .36); background: #fff4f2; box-shadow: 0 10px 24px rgba(180, 35, 24, .12); }
    .summary .priority-summary-high strong { color: #9a4b08; font-weight: 900; }
    .summary .priority-summary-critical strong { color: #b42318; font-weight: 900; text-transform: uppercase; }
    .panel { display: grid; gap: 1rem; padding: 1rem; }
    .form { display: grid; grid-template-columns: minmax(180px, 280px) 1fr auto; gap: .85rem; align-items: end; }
    .wide { min-width: 0; }
    label { display: grid; gap: .35rem; font-size: .82rem; color: var(--color-text-body); }
    input, select, textarea { min-height: 38px; padding: .55rem .65rem; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: var(--color-text-strong); }
    button { min-height: 36px; padding: 0 .75rem; border: 0; border-radius: 6px; background: var(--color-primary); color: #fff; cursor: pointer; }
    .ghost { background: var(--color-surface-muted); color: #263040; } .danger { background: #d92d20; }
    .notes { display: grid; gap: .75rem; } .note { padding: .9rem; display: grid; gap: .75rem; } .note header { display: flex; justify-content: space-between; gap: .75rem; }
    .row-actions, .actions { display: flex; gap: .4rem; flex-wrap: wrap; }
    .note-content { color: var(--color-text-body); line-height: 1.45; }
    .note-content ::ng-deep p { margin: .35rem 0; } .note-content ::ng-deep ul { margin: .35rem 0 .35rem 1.2rem; padding: 0; }
    .feedback { color: #027a48; } .error { color: #b42318; }
    @media (max-width: 760px) { .page__header, .note header { display: grid; } .form { grid-template-columns: 1fr; } }
  `],
})
export class ProcessoDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly processoService = inject(ProcessoService);
  private readonly anotacaoService = inject(AnotacaoService);
  private readonly toast = inject(ToastService);

  protected readonly processo = signal<Processo | null>(null);
  protected readonly anotacoes = signal<Anotacao[]>([]);
  protected readonly feedback = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly editandoAnotacaoId = signal<number | null>(null);
  protected readonly statusOptions: StatusProcesso[] = ['ABERTO', 'EM_ANDAMENTO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO', 'ARQUIVADO'];
  protected statusRapido: StatusProcesso = 'ABERTO';
  protected readonly anotacaoForm: AnotacaoPayload = { titulo: '', texto: '' };
  private readonly processoId = Number(this.route.snapshot.paramMap.get('id'));

  constructor() {
    this.carregar();
  }

  protected statusLabel(status: StatusProcesso): string {
    return { ABERTO: 'Aberto', EM_ANDAMENTO: 'Em andamento', PAUSADO: 'Pausado', CONCLUIDO: 'Concluido', CANCELADO: 'Cancelado', ARQUIVADO: 'Arquivado' }[status] ?? status;
  }

  protected prioridadeLabel(prioridade: Processo['prioridade']): string {
    return { BAIXA: 'Baixa', MEDIA: 'Media', ALTA: 'Alta', CRITICA: 'Critica' }[prioridade] ?? prioridade;
  }

  protected prioridadeSummaryClass(prioridade: Processo['prioridade']): string {
    return prioridade === 'CRITICA' ? 'priority-summary-critical' : prioridade === 'ALTA' ? 'priority-summary-high' : '';
  }

  protected formatarData(data?: string | null): string {
    return data ? new Date(data).toLocaleString('pt-BR') : '-';
  }

  protected alterarStatus(): void {
    const item = this.processo();
    if (!item) return;
    this.processoService.atualizar(item.id, {
      titulo: item.titulo,
      descricao: item.descricao ?? '',
      statusProcesso: this.statusRapido,
      centroCusto: item.centroCusto ?? '',
      dataInicio: item.dataInicio ? item.dataInicio.slice(0, 16) : '',
      dataPrevisaoConclusao: item.dataPrevisaoConclusao ? item.dataPrevisaoConclusao.slice(0, 16) : '',
      dataFim: item.dataFim ? item.dataFim.slice(0, 16) : '',
      prioridade: item.prioridade,
      setorId: item.setorId,
      unidadeSondaId: item.unidadeSondaId ?? 0,
      projetoId: item.projetoId ?? null,
      responsavelUsername: item.responsavelUsername ?? null,
    }).subscribe({
      next: (processo) => {
        this.processo.set(processo);
        this.toast.success('Status atualizado com sucesso.');
      },
      error: (error: Error) => this.notificarErro(error),
    });
  }

  protected salvarAnotacao(): void {
    if (!this.anotacaoForm.titulo?.trim() || this.anotacaoSemTexto()) {
      this.toast.warning('Preencha os campos obrigatorios.');
      return;
    }
    const id = this.editandoAnotacaoId();
    const request = id
      ? this.anotacaoService.atualizar(this.processoId, id, this.anotacaoForm)
      : this.anotacaoService.criar(this.processoId, this.anotacaoForm);
    request.subscribe({
      next: () => {
        this.toast.success(id ? 'Anotacao atualizada com sucesso.' : 'Anotacao criada com sucesso.');
        this.limparAnotacao();
        this.carregarAnotacoes();
      },
      error: (error: Error) => this.notificarErro(error),
    });
  }

  protected editarAnotacao(anotacao: Anotacao): void {
    this.editandoAnotacaoId.set(anotacao.id);
    Object.assign(this.anotacaoForm, { titulo: anotacao.titulo, texto: anotacao.texto });
  }

  protected excluirAnotacao(anotacao: Anotacao): void {
    if (!confirm(`Excluir anotacao ${anotacao.titulo}?`)) return;
    this.anotacaoService.excluir(this.processoId, anotacao.id).subscribe({
      next: () => {
        this.toast.success('Anotacao excluida com sucesso.');
        this.carregarAnotacoes();
      },
      error: (error: Error) => this.notificarErro(error),
    });
  }

  protected limparAnotacao(): void {
    this.editandoAnotacaoId.set(null);
    Object.assign(this.anotacaoForm, { titulo: '', texto: '' });
  }

  private carregar(): void {
    this.processoService.buscarPorId(this.processoId).subscribe({
      next: (processo) => {
        this.processo.set(processo);
        this.statusRapido = processo.statusProcesso;
      },
      error: (error: Error) => this.notificarErro(error),
    });
    this.carregarAnotacoes();
  }

  private carregarAnotacoes(): void {
    this.anotacaoService.listarPorProcesso(this.processoId).subscribe({
      next: (anotacoes) => this.anotacoes.set(anotacoes),
      error: (error: Error) => this.notificarErro(error),
    });
  }

  private notificarErro(error: Error): void {
    const message = error?.message || 'Nao foi possivel concluir a operacao.';
    this.error.set(message);
    this.toast.error(message);
  }

  private anotacaoSemTexto(): boolean {
    const texto = this.anotacaoForm.texto.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    return !texto;
  }
}
