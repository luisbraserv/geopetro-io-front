import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngxs/store';

import { AuthState } from '../../../auth/state/auth.state';
import { UnidadeSondaService } from '../../../cadastros/services/unidade-sonda.service';
import { UnidadeSonda } from '../../../cadastros/models/cadastros.model';
import { Anotacao, Observacao, Processo, StatusProcesso, Prioridade } from '../../models/processo.model';
import { AnotacaoService } from '../../services/anotacao.service';
import { ObservacaoService } from '../../services/observacao.service';
import { ProcessoService } from '../../services/processo.service';

type GrupoUnidade = {
  unidadeId: number;
  unidadeNome: string;
  unidadeApelido?: string | null;
  setorNome: string;
  processos: Processo[];
};

@Component({
  selector: 'app-processos-resumo-page',
  imports: [CommonModule],
  template: `
    <div class="page-actions no-print">
      <button class="btn-back" (click)="voltar()">← Voltar</button>
      <button class="btn-print" (click)="imprimir()">🖨 Imprimir</button>
    </div>

    <div class="loading no-print" *ngIf="carregando()">Carregando dados...</div>

    <div class="a4" *ngIf="!carregando()">

      <!-- Cabeçalho -->
      <header class="r-header">
        <div>
          <p class="r-brand">Braserv Horus</p>
          <h1>Resumo dos Processos</h1>
          <span class="r-date">Gerado em {{ dataResumo }}</span>
        </div>
        <div class="r-total">{{ processos().length }}</div>
      </header>

      <!-- KPIs -->
      <section class="r-kpis">
        <div><span>Total</span><strong>{{ processos().length }}</strong></div>
        <div><span>Em andamento</span><strong>{{ totalPorStatus('EM_ANDAMENTO') }}</strong></div>
        <div><span>Alta / Crítica</span><strong>{{ totalAltaPrioridade() }}</strong></div>
        <div><span>Unidades/Sondas</span><strong>{{ processosPorUnidade().length }}</strong></div>
      </section>

      <!-- Processos agrupados por unidade -->
      <section class="r-unit-block" *ngFor="let grupo of processosPorUnidade()">
        <header class="r-group-header">
          <div>
            <h2>{{ grupo.unidadeNome }}</h2>
            <p>{{ grupo.unidadeApelido || 'Sem apelido' }} · {{ grupo.setorNome }}</p>
          </div>
          <span>{{ grupo.processos.length }} {{ grupo.processos.length === 1 ? 'processo' : 'processos' }}</span>
        </header>

        <div class="r-process-list">
          <article class="r-process" [ngClass]="prioridadeClass(p.prioridade)" *ngFor="let p of grupo.processos">
            <div class="r-process-title">
              <h3>{{ p.titulo }}</h3>
              <div>
                <span class="r-badge r-status">{{ statusLabel(p.statusProcesso) }}</span>
                <span class="r-badge r-priority">{{ prioridadeLabel(p.prioridade) }}</span>
              </div>
            </div>
            <dl>
              <div><dt>Projeto</dt><dd>{{ p.projetoNome || '-' }}</dd></div>
              <div><dt>Responsável</dt><dd>{{ p.responsavelNome || p.responsavelUsername || '-' }}</dd></div>
              <div><dt>Centro de custo</dt><dd>{{ p.centroCusto || '-' }}</dd></div>
              <div><dt>Atualizado</dt><dd>{{ fmt(p.atualizadoEm) }}</dd></div>
            </dl>
            <p class="r-desc">{{ p.descricao || 'Sem descrição informada.' }}</p>
            <div class="r-notes" *ngIf="anotacoes()[p.id]?.length">
              <p class="r-notes-label">Anotações</p>
              <div class="r-note" *ngFor="let a of anotacoes()[p.id]">
                <div class="r-note-head">
                  <strong>{{ a.titulo }}</strong>
                  <span>{{ fmt(a.dataCriacao) }} · {{ a.criadoPorUsername || '-' }}</span>
                </div>
                <div class="r-note-body" [innerHTML]="a.texto"></div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- Observações -->
      <section class="r-obs-section" *ngIf="observacoes().length">
        <header class="r-obs-section-header">
          <div>
            <p class="r-brand" style="color:#6a9c4a">Observações</p>
            <h2 style="font-size:15px">Observações do Setor</h2>
          </div>
          <span class="r-obs-count">{{ observacoes().length }} {{ observacoes().length === 1 ? 'observação' : 'observações' }}</span>
        </header>

        <article class="r-obs" *ngFor="let obs of observacoes()">
          <div class="r-obs-head">
            <strong>{{ obs.titulo }}</strong>
            <span>{{ obs.setorNome }} · {{ fmt(obs.atualizadoEm) }} · {{ obs.criadoPorUsername || '-' }}</span>
          </div>
          <div class="r-note-body" [innerHTML]="obs.texto"></div>
        </article>
      </section>

    </div>
  `,
  styles: [`
    :host { display: block; background: #e8eaed; min-height: 100vh; padding: 2rem; box-sizing: border-box; font-family: inherit; }

    /* ── Barra de ações ── */
    .page-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-bottom: 1.5rem; }
    .btn-back, .btn-print { padding: .6rem 1.2rem; border-radius: 6px; border: 1px solid #cbd5e1; font-size: .85rem; font-weight: 700; cursor: pointer; background: #fff; color: #1f2937; }
    .btn-print { background: #528c9c; border-color: #528c9c; color: #fff; }
    .loading { text-align: center; padding: 4rem; color: #5b6b70; font-size: 1rem; }

    /* ── Folha A4 ── */
    .a4 { width: 210mm; margin: 0 auto; padding: 16mm; box-sizing: border-box; background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,.18); font-size: 11px; color: #212f33; }

    /* ── Cabeçalho ── */
    .r-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 3px solid #528c9c; margin-bottom: 12px; }
    .r-brand { margin: 0 0 2px; color: #528c9c; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
    h1 { margin: 0 0 3px; font-size: 22px; color: #212f33; }
    .r-date { color: #5b6b70; font-size: 9px; }
    .r-total { min-width: 58px; min-height: 58px; display: grid; place-items: center; background: #528c9c; color: #fff; border-radius: 8px; font-size: 24px; font-weight: 900; }

    /* ── KPIs ── */
    .r-kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 7px; margin-bottom: 20px; }
    .r-kpis div { padding: 8px 10px; border: 1px solid #d7e1e4; border-radius: 7px; background: #f8fbfc; }
    .r-kpis span { display: block; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #5b6b70; }
    .r-kpis strong { display: block; margin-top: 3px; font-size: 18px; color: #212f33; }

    /* ── Bloco de unidade ── */
    .r-unit-block { margin-bottom: 22px; border: 1px solid #d7e1e4; border-radius: 8px; overflow: hidden; break-inside: avoid-page; }
    .r-group-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: linear-gradient(90deg,#edf5f7 0%,#f5fafb 100%); border-bottom: 2px solid #528c9c; }
    .r-group-header h2 { margin: 0; font-size: 14px; color: #212f33; font-weight: 900; }
    .r-group-header p { margin: 3px 0 0; color: #5b6b70; font-size: 9px; }
    .r-group-header > span { color: #528c9c; font-size: 10px; font-weight: 900; white-space: nowrap; padding: 4px 10px; background: #fff; border: 1px solid #b8d5dd; border-radius: 99px; }
    .r-process-list { display: grid; gap: 0; }

    /* ── Card de processo ── */
    .r-process { display: grid; gap: 6px; padding: 10px 12px; border-bottom: 1px solid #edf1f3; background: #fff; }
    .r-process:last-child { border-bottom: none; }
    .r-process.high { background: #fffaf2; border-left: 4px solid #c56a22; padding-left: 8px; }
    .r-process.critical { background: #fff5f3; border-left: 4px solid #b42318; padding-left: 8px; }
    .r-process-title { display: flex; justify-content: space-between; align-items: flex-start; gap: .5rem; }
    h3 { margin: 0; font-size: 12px; color: #212f33; font-weight: 800; }
    dl { display: grid; grid-template-columns: repeat(4,1fr); gap: 5px; margin: 0; }
    dl div { min-width: 0; }
    dt { color: #5b6b70; font-size: 8px; font-weight: 900; text-transform: uppercase; }
    dd { margin: 1px 0 0; color: #212f33; font-size: 9px; font-weight: 700; overflow-wrap: anywhere; }
    .r-desc { margin: 0; color: #38484d; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }

    /* ── Badges ── */
    .r-badge { display: inline-flex; padding: 2px 7px; border-radius: 999px; font-size: 8px; font-weight: 900; white-space: nowrap; }
    .r-status { background: #eef5f7; color: #528c9c; }
    .r-priority { background: #f5efe2; color: #9c8153; margin-left: 3px; }
    .high .r-priority { background: #fff0d9; color: #9a4b08; }
    .critical .r-priority { background: #fee4e2; color: #b42318; text-transform: uppercase; }

    /* ── Anotações dentro do processo ── */
    .r-notes { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #d7e1e4; display: grid; gap: 4px; }
    .r-notes-label { margin: 0 0 4px; font-size: 8px; font-weight: 900; text-transform: uppercase; color: #5b6b70; letter-spacing: .05em; }
    .r-note { padding: 5px 8px; background: #f8fbfc; border: 1px solid #d7e1e4; border-radius: 5px; display: grid; gap: 2px; }
    .r-note-head { display: flex; justify-content: space-between; align-items: baseline; gap: .5rem; }
    .r-note-head strong { font-size: 9px; color: #212f33; }
    .r-note-head span { font-size: 8px; color: #5b6b70; white-space: nowrap; flex-shrink: 0; }
    .r-note-body { font-size: 9px; color: #38484d; line-height: 1.4; overflow-wrap: anywhere; }
    .r-note-body ::ng-deep p { margin: 1px 0; }

    /* ── Seção de observações ── */
    .r-obs-section { margin-top: 28px; border: 2px solid #6a9c4a; border-radius: 8px; overflow: hidden; break-before: page; }
    .r-obs-section-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: linear-gradient(90deg,#f0f6ea 0%,#f7fbf3 100%); border-bottom: 2px solid #6a9c4a; }
    .r-obs-section-header h2 { margin: 0; font-size: 14px; color: #2d4a1e; font-weight: 900; }
    .r-obs-count { color: #6a9c4a; font-size: 10px; font-weight: 900; padding: 4px 10px; background: #fff; border: 1px solid #a8d08a; border-radius: 99px; }
    .r-obs { display: grid; gap: 5px; padding: 10px 12px; border-bottom: 1px solid #ddeedd; background: #fff; }
    .r-obs:last-child { border-bottom: none; }
    .r-obs:nth-child(even) { background: #f8fbf5; }
    .r-obs-head { display: flex; justify-content: space-between; align-items: baseline; gap: .5rem; }
    .r-obs-head strong { font-size: 11px; color: #212f33; font-weight: 800; }
    .r-obs-head span { font-size: 9px; color: #5b6b70; white-space: nowrap; flex-shrink: 0; }

    @media print {
      @page { size: A4; margin: 14mm; }
      :host { background: none !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .a4 { box-shadow: none !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
      .r-unit-block { break-inside: avoid-page; margin-bottom: 14px; }
      .r-process { break-inside: avoid; }
      .r-obs-section { break-before: page; }
      .r-obs { break-inside: avoid; }
    }
  `],
})
export class ProcessosResumoPageComponent implements OnInit {
  private readonly processoService = inject(ProcessoService);
  private readonly anotacaoService = inject(AnotacaoService);
  private readonly observacaoService = inject(ObservacaoService);
  private readonly unidadeService = inject(UnidadeSondaService);
  private readonly store = inject(Store);
  private readonly router = inject(Router);

  protected readonly processos = signal<Processo[]>([]);
  protected readonly unidades = signal<UnidadeSonda[]>([]);
  protected readonly anotacoes = signal<Record<number, Anotacao[]>>({});
  protected readonly observacoes = signal<Observacao[]>([]);
  protected readonly carregando = signal(true);

  protected readonly dataResumo = new Date().toLocaleString('pt-BR');

  protected readonly processosPorUnidade = computed<GrupoUnidade[]>(() => {
    const mapa = new Map<number, GrupoUnidade>();
    const unidadesPorId = new Map(this.unidades().map((u) => [u.id, u]));
    this.processos().forEach((p) => {
      const uid = p.unidadeSondaId ?? 0;
      const u = unidadesPorId.get(uid);
      const g = mapa.get(uid) ?? {
        unidadeId: uid,
        unidadeNome: p.unidadeSondaNome || u?.nome || 'Sem unidade',
        unidadeApelido: p.unidadeSondaApelido || u?.apelido,
        setorNome: p.setorNome || u?.setorNome || '-',
        processos: [],
      };
      g.processos.push(p);
      mapa.set(uid, g);
    });
    return Array.from(mapa.values()).sort((a, b) => a.unidadeNome.localeCompare(b.unidadeNome));
  });

  protected readonly totalAltaPrioridade = computed(() =>
    this.processos().filter((p) => p.prioridade === 'ALTA' || p.prioridade === 'CRITICA').length,
  );


  ngOnInit(): void {
    const user = this.store.selectSnapshot(AuthState.currentUser);
    const setorIds = user?.roles?.includes('ADMIN')
      ? []
      : user?.setorIds?.length
        ? user.setorIds
        : user?.setorId
          ? [user.setorId]
          : [];

    this.unidadeService.listar(setorIds.length ? setorIds : null).subscribe({
      next: (u) => this.unidades.set(u),
    });

    const filtros = { setorIds: setorIds.length ? setorIds : undefined };
    this.processoService.listar(filtros).subscribe({
      next: (lista) => {
        const ativos = lista.filter((p) => p.statusProcesso !== 'ARQUIVADO');
        this.processos.set(ativos);
        let pendentes = ativos.length;
        if (pendentes === 0) { this.carregando.set(false); return; }
        ativos.forEach((p) => {
          this.anotacaoService.listarPorProcesso(p.id).subscribe({
            next: (a) => {
              this.anotacoes.update((atual) => ({ ...atual, [p.id]: a }));
              pendentes--;
              if (pendentes === 0) this.carregando.set(false);
            },
            error: () => { pendentes--; if (pendentes === 0) this.carregando.set(false); },
          });
        });
      },
      error: () => this.carregando.set(false),
    });

    const obs$ = setorIds.length
      ? this.observacaoService.listarPorSetores(setorIds)
      : this.observacaoService.listarPorSetores([]);
    obs$.subscribe({ next: (o) => this.observacoes.set(o) });
  }

  protected voltar(): void {
    this.router.navigate(['/app/gerenciamento/processos']);
  }

  protected imprimir(): void {
    window.print();
  }

  protected totalPorStatus(status: StatusProcesso): number {
    return this.processos().filter((p) => p.statusProcesso === status).length;
  }

  protected statusLabel(status: StatusProcesso): string {
    return ({ ABERTO: 'Aberto', EM_ANDAMENTO: 'Em andamento', PAUSADO: 'Pausado', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado', ARQUIVADO: 'Arquivado' })[status];
  }

  protected prioridadeLabel(p: Prioridade): string {
    return ({ BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' })[p];
  }

  protected prioridadeClass(p: Prioridade): string {
    return p === 'CRITICA' ? 'critical' : p === 'ALTA' ? 'high' : '';
  }

  protected fmt(data?: string | null): string {
    return data ? new Date(data).toLocaleString('pt-BR') : '-';
  }
}

