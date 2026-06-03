import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { Store } from '@ngxs/store';

import { RichTextEditorComponent } from '../../../../shared/rich-text-editor/rich-text-editor.component';
import { ToastService } from '../../../../shared/toast/toast.service';
import { Projeto, Regional, Setor, UnidadeSonda } from '../../../cadastros/models/cadastros.model';
import { ProjetoService } from '../../../cadastros/services/projeto.service';
import { RegionalService } from '../../../cadastros/services/regional.service';
import { SetorService } from '../../../cadastros/services/setor.service';
import { UnidadeSondaService } from '../../../cadastros/services/unidade-sonda.service';
import { AuthState } from '../../../auth/state/auth.state';
import { UsuarioResponse } from '../../../usuarios/models/usuario-api.model';
import { UsuariosService } from '../../../usuarios/services/usuarios.service';
import { Anotacao, AnotacaoPayload, Observacao, ObservacaoPayload, Prioridade, Processo, ProcessoFiltros, ProcessoPayload, StatusProcesso } from '../../models/processo.model';
import { AnotacaoService } from '../../services/anotacao.service';
import { ObservacaoService } from '../../services/observacao.service';
import { ProcessoService } from '../../services/processo.service';

type ModalTipo = 'processo' | 'anotacao' | 'confirmar-arquivar' | 'confirmar-anotacao' | 'resumo' | 'observacao' | 'confirmar-observacao' | null;
type GrupoProjetoProcessos = {
  projetoId: number;
  projetoNome: string;
  setorNome: string;
  processos: Processo[];
};

@Component({
  selector: 'app-processos-page',
  imports: [CommonModule, FormsModule, TuiButton, TuiIcon, RichTextEditorComponent],
  template: `
    <section class="process-page">
      <header class="page-hero">
        <div>
          <p class="eyebrow">Gerenciamento</p>
          <h1>Gerenciamento de Processos</h1>
          <p class="subtitle">Acompanhe processos por unidade/sonda, responsável, prioridade e histórico de anotações.</p>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end">
          <button tuiButton type="button" appearance="secondary" (click)="irParaResumo()">
            <tui-icon icon="@tui.printer"></tui-icon>
            Resumo A4
          </button>
          <button tuiButton type="button" appearance="secondary" (click)="irParaArquivados()">
            <tui-icon icon="@tui.archive"></tui-icon>
            Arquivados
          </button>
          <button tuiButton type="button" appearance="primary" (click)="abrirProcesso()">
            <tui-icon icon="@tui.plus"></tui-icon>
            Novo Processo
          </button>
        </div>
      </header>

      <div class="summary-grid">
        <article><span>Total de Unidades/Sondas</span><strong>{{ unidades().length }}</strong></article>
        <article><span>Total de Processos</span><strong>{{ processos().length }}</strong></article>
        <article><span>Em andamento</span><strong>{{ totalPorStatus('EM_ANDAMENTO') }}</strong></article>
        <article class="critical-summary"><span>Alta/Critica</span><strong>{{ totalAltaPrioridade() }}</strong></article>
      </div>

      <p class="feedback" *ngIf="feedback()">{{ feedback() }}</p>
      <p class="error" *ngIf="error()">{{ error() }}</p>

      <form class="filters" (ngSubmit)="carregarProcessos()">
        <input name="texto" placeholder="Buscar por título ou descrição" [(ngModel)]="filtros.texto" />
        <select name="status" [(ngModel)]="filtros.status">
          <option value="">Todos os status</option>
          <option *ngFor="let status of statusOptions" [value]="status">{{ statusLabel(status) }}</option>
        </select>
        <select name="prioridade" [(ngModel)]="filtros.prioridade">
          <option value="">Todas as prioridades</option>
          <option *ngFor="let prioridade of prioridadeOptions" [value]="prioridade">{{ prioridadeLabel(prioridade) }}</option>
        </select>
        <select name="setorId" [(ngModel)]="filtros.setorId" (ngModelChange)="sincronizarFiltrosSetor()">
          <option value="">Todos os setores</option>
          <option *ngFor="let setor of setoresDisponiveisFiltro()" [ngValue]="setor.id">{{ setor.nome }}</option>
        </select>
        <select name="unidadeSondaId" [(ngModel)]="filtros.unidadeSondaId" (ngModelChange)="sincronizarProjetoFiltro()">
          <option value="">Todas as unidades/sondas</option>
          <option *ngFor="let unidade of unidadesDisponiveisFiltro()" [ngValue]="unidade.id">{{ unidade.nome }}</option>
        </select>
        <select name="projetoId" [(ngModel)]="filtros.projetoId">
          <option value="">Todos os projetos</option>
          <option *ngFor="let projeto of projetosDisponiveisFiltro()" [ngValue]="projeto.id">{{ projeto.nome }}</option>
        </select>
        <select name="responsavelUsername" [(ngModel)]="filtros.responsavelUsername">
          <option value="">Todos os responsáveis</option>
          <option *ngFor="let usuario of responsaveisFiltro()" [ngValue]="usuario.username">{{ usuario.nome }}</option>
        </select>
        <button tuiButton type="submit" appearance="secondary">Filtrar</button>
      </form>

      <div class="content-grid">
      <main class="unit-list col-8">
        <section class="unit-block" *ngFor="let grupo of processosPorProjeto()">
          <header class="unit-block__header" role="button" tabindex="0" (click)="alternarProjeto(grupo.projetoId)" (keyup.enter)="alternarProjeto(grupo.projetoId)" style="cursor:pointer">
            <div>
              <p class="eyebrow">Projeto</p>
              <h2>{{ grupo.projetoNome }}</h2>
              <span>{{ grupo.setorNome }}</span>
            </div>
            <div style="display:flex;align-items:center;gap:.75rem">
              <div class="unit-block__stats">
                <strong>{{ grupo.processos.length }}</strong>
                <span>{{ grupo.processos.length === 1 ? 'processo' : 'processos' }}</span>
              </div>
              <button tuiButton type="button" size="s" appearance="secondary" (click)="$event.stopPropagation(); alternarProjeto(grupo.projetoId)">
                <tui-icon [icon]="projetoExpandido(grupo.projetoId) ? '@tui.chevron-up' : '@tui.chevron-down'"></tui-icon>
                {{ projetoExpandido(grupo.projetoId) ? 'Ocultar' : 'Mostrar' }}
              </button>
            </div>
          </header>

          <div class="process-list" *ngIf="projetoExpandido(grupo.projetoId)">
        <article class="process-card" [ngClass]="prioridadeCardClass(processo.prioridade)" *ngFor="let processo of grupo.processos">
          <div class="process-card__main" role="button" tabindex="0" (click)="alternarExpansao(processo)" (keyup.enter)="alternarExpansao(processo)">
            <div class="process-card__title">
              <span class="badge" [ngClass]="statusClass(processo.statusProcesso)">{{ statusLabel(processo.statusProcesso) }}</span>
              <h2>{{ processo.titulo }}</h2>
              <p class="process-description">{{ descricaoCompleta(processo.descricao) }}</p>
            </div>
            <div class="process-card__meta">
              <span><strong>Centro de custo</strong>{{ processo.centroCusto || '-' }}</span>
              <span><strong>Setor</strong>{{ processo.setorNome }}</span>
              <span><strong>Unidade/Sonda</strong>{{ processo.unidadeSondaNome || '-' }}</span>
              <span><strong>Responsável</strong>{{ processo.responsavelNome || processo.responsavelUsername || 'Sem responsável' }}</span>
              <span><strong>Previsao</strong>{{ formatarDataHora(processo.dataPrevisaoConclusao) }}</span>
              <span><strong>Atualizado</strong>{{ formatarDataHora(processo.atualizadoEm) }}</span>
            </div>
            <div class="process-card__actions" (click)="$event.stopPropagation()">
              <span class="priority" [ngClass]="prioridadeClass(processo.prioridade)">
                <tui-icon *ngIf="processo.prioridade === 'ALTA' || processo.prioridade === 'CRITICA'" icon="@tui.triangle-alert"></tui-icon>
                {{ prioridadeLabel(processo.prioridade) }}
              </span>
              <span class="deadline-badge" [ngClass]="prazoClass(processo)">
                {{ prazoLabel(processo) }}
              </span>
              <button tuiButton type="button" size="s" appearance="secondary" (click)="abrirProcesso(processo)">
                <tui-icon icon="@tui.pencil"></tui-icon>
                Editar
              </button>
              <button tuiButton type="button" size="s" appearance="destructive" (click)="confirmarArquivarProcesso(processo)">
                <tui-icon icon="@tui.archive"></tui-icon>
                Arquivar processo
              </button>
              <button tuiButton type="button" size="s" appearance="secondary" (click)="alternarExpansao(processo)">
                <tui-icon [icon]="expandido(processo.id) ? '@tui.chevron-up' : '@tui.chevron-down'"></tui-icon>
                {{ expandido(processo.id) ? 'Fechar' : 'Abrir' }}
              </button>
            </div>
          </div>

          <section class="process-card__details" *ngIf="expandido(processo.id)">
            <div class="detail-grid">
              <div><strong>Unidade/Sonda</strong><span>{{ processo.unidadeSondaNome || '-' }}</span></div>
              <div><strong>Setor</strong><span>{{ processo.setorNome }}</span></div>
              <div><strong>Projeto</strong><span>{{ processo.projetoNome || '-' }}</span></div>
              <div><strong>Responsável</strong><span>{{ processo.responsavelNome || processo.responsavelUsername || 'Sem responsável' }}</span></div>
              <div><strong>Status</strong><span>{{ statusLabel(processo.statusProcesso) }}</span></div>
              <div [ngClass]="prioridadeDetailClass(processo.prioridade)">
                <strong>Prioridade</strong>
                <span>{{ prioridadeLabel(processo.prioridade) }}</span>
              </div>
              <div><strong>Centro de custo</strong><span>{{ processo.centroCusto || '-' }}</span></div>
              <div><strong>Previsao de conclusao</strong><span>{{ formatarDataHora(processo.dataPrevisaoConclusao) }}</span></div>
              <div><strong>Conclusao real</strong><span>{{ formatarDataHora(processo.dataFim) }}</span></div>
            </div>

            <div class="notes-head">
              <h3>Anotações</h3>
              <button tuiButton type="button" size="s" appearance="primary" (click)="abrirAnotacao(processo)">
                <tui-icon icon="@tui.plus"></tui-icon>
                Nova Anotação
              </button>
            </div>

            <div class="note-list">
              <article class="note" *ngFor="let anotacao of anotacoesDoProcesso(processo.id)">
                <div>
                  <strong>{{ anotacao.titulo }}</strong>
                  <span>{{ formatarDataHora(anotacao.dataCriacao) }} · {{ anotacao.criadoPorUsername || 'Sem autor' }}</span>
                  <div class="note-content" [innerHTML]="anotacao.texto"></div>
                </div>
                <div class="note-actions">
                  <button tuiButton type="button" size="s" appearance="secondary" (click)="abrirAnotacao(processo, anotacao)">
                    <tui-icon icon="@tui.pencil"></tui-icon>
                    Editar
                  </button>
              <button tuiButton type="button" size="s" appearance="destructive" (click)="confirmarExcluirAnotacao(processo, anotacao)">
                <tui-icon icon="@tui.trash-2"></tui-icon>
                    Excluir anotaÃ§Ã£o
              </button>
                </div>
              </article>
              <p class="empty" *ngIf="!anotacoesDoProcesso(processo.id).length">Nenhuma anotação registrada para este processo.</p>
            </div>
          </section>
        </article>
          </div>
        </section>

        <p class="empty empty-main" *ngIf="!processosPorProjeto().length">Nenhum processo encontrado para os filtros selecionados.</p>
      </main>

      <aside class="obs-panel col-4">
        <header class="obs-panel__header">
          <div>
            <p class="eyebrow">Setor</p>
            <h2>Observações</h2>
          </div>
          <button tuiButton type="button" size="s" appearance="primary" (click)="abrirObservacao()">
            <tui-icon icon="@tui.plus"></tui-icon>
            Nova
          </button>
        </header>
        <div class="obs-list">
          <article class="obs-card" *ngFor="let obs of observacoes()">
            <div class="obs-card__body">
              <strong>{{ obs.titulo }}</strong>
              <span class="obs-meta">{{ obs.setorNome }} · {{ formatarDataHora(obs.atualizadoEm) }} · {{ obs.criadoPorUsername || 'Sem autor' }}</span>
              <div class="obs-content" [innerHTML]="obs.texto"></div>
            </div>
            <div class="obs-actions">
              <button tuiButton type="button" size="s" appearance="secondary" (click)="abrirObservacao(obs)">
                <tui-icon icon="@tui.pencil"></tui-icon>
              </button>
              <button tuiButton type="button" size="s" appearance="destructive" (click)="confirmarExcluirObservacao(obs)">
                <tui-icon icon="@tui.trash-2"></tui-icon>
              </button>
            </div>
          </article>
          <p class="empty" *ngIf="!observacoes().length">Nenhuma observação registrada para o seu setor.</p>
        </div>
      </aside>
      </div>

      <div class="modal-backdrop" *ngIf="modalTipo() && modalTipo() !== 'resumo'" (click)="fecharModal()">
        <section class="modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <header class="modal__header">
            <div>
              <p class="eyebrow">{{ modalTituloEyebrow() }}</p>
              <h2>{{ modalTitulo() }}</h2>
            </div>
            <button tuiButton type="button" appearance="secondary" size="s" (click)="fecharModal()">
              <tui-icon icon="@tui.x"></tui-icon>
            </button>
          </header>

          <form class="modal-form" *ngIf="modalTipo() === 'processo'" (ngSubmit)="salvarProcesso()">
            <label>Título<input name="titulo" [(ngModel)]="form.titulo" required /></label>
            <label>Regional
              <select name="modalRegionalId" [ngModel]="formRegionalId()" (ngModelChange)="aoTrocarRegionalModal($event)">
                <option [ngValue]="0">Selecione uma regional</option>
                <option *ngFor="let r of regionaisDoModal()" [ngValue]="r.id">{{ r.nome }}</option>
              </select>
            </label>
            <label>Setor
              <select name="setorId" [(ngModel)]="form.setorId" required (ngModelChange)="sincronizarModalAoTrocarSetor()">
                <option [ngValue]="0">Selecione</option>
                <option *ngFor="let setor of setoresDoModal()" [ngValue]="setor.id">{{ setor.nome }}</option>
              </select>
            </label>
            <label>Unidade/Sonda
              <select name="unidadeSondaId" [(ngModel)]="form.unidadeSondaId" required (ngModelChange)="sincronizarSetorPelaUnidade()">
                <option [ngValue]="0">Selecione</option>
                <option *ngFor="let unidade of unidadesDoModal()" [ngValue]="unidade.id">{{ unidade.nome }}</option>
              </select>
            </label>
            <label>Projeto
              <select name="projetoId" [(ngModel)]="form.projetoId" required>
                <option [ngValue]="null">Selecione</option>
                <option *ngFor="let projeto of projetosDisponiveis()" [ngValue]="projeto.id">{{ projeto.nome }}</option>
              </select>
            </label>
            <label>Responsável
              <select name="responsavelUsername" [(ngModel)]="form.responsavelUsername">
                <option [ngValue]="null">Sem responsável</option>
                <option *ngFor="let usuario of responsaveisDisponiveis()" [ngValue]="usuario.username">{{ usuario.nome }} - {{ usuario.username }}</option>
              </select>
            </label>
            <label>Status<select name="statusProcesso" [(ngModel)]="form.statusProcesso"><option *ngFor="let status of statusOptions" [value]="status">{{ statusLabel(status) }}</option></select></label>
            <label>Prioridade<select name="prioridade" [(ngModel)]="form.prioridade"><option *ngFor="let prioridade of prioridadeOptions" [value]="prioridade">{{ prioridadeLabel(prioridade) }}</option></select></label>
            <label>Centro de custo<input name="centroCusto" [(ngModel)]="form.centroCusto" /></label>
            <label>Data início<input name="dataInicio" type="datetime-local" [(ngModel)]="form.dataInicio" /></label>
            <label>Previsao de conclusao<input name="dataPrevisaoConclusao" type="datetime-local" [(ngModel)]="form.dataPrevisaoConclusao" /></label>
            <label>Data fim<input name="dataFim" type="datetime-local" [(ngModel)]="form.dataFim" /></label>
            <label class="wide">Descrição<textarea name="descricao" rows="4" [(ngModel)]="form.descricao"></textarea></label>
            <div class="modal-actions wide">
              <button tuiButton type="button" appearance="secondary" (click)="fecharModal()">Cancelar</button>
              <button tuiButton type="submit" appearance="primary">{{ editandoId() ? 'Atualizar' : 'Criar' }}</button>
            </div>
          </form>

          <form class="modal-form" *ngIf="modalTipo() === 'anotacao'" (ngSubmit)="salvarAnotacao()">
            <label>Título<input name="tituloAnotacao" [(ngModel)]="anotacaoForm.titulo" required /></label>
            <label class="wide">Conteúdo
              <app-rich-text-editor [(value)]="anotacaoForm.texto" placeholder="Digite a anotação..." />
            </label>
            <div class="modal-actions wide">
              <button tuiButton type="button" appearance="secondary" (click)="fecharModal()">Cancelar</button>
              <button tuiButton type="submit" appearance="primary">{{ editandoAnotacaoId() ? 'Atualizar' : 'Adicionar' }}</button>
            </div>
          </form>

          <form class="modal-form" *ngIf="modalTipo() === 'observacao'" (ngSubmit)="salvarObservacao()">
            <label class="wide">Título<input name="tituloObs" [(ngModel)]="obsForm.titulo" required /></label>
            <label class="wide">Conteúdo
              <app-rich-text-editor [value]="obsTexto()" (valueChange)="obsTexto.set($event)" placeholder="Digite a observação..." />
            </label>
            <div class="modal-actions wide">
              <button tuiButton type="button" appearance="secondary" (click)="fecharModal()">Cancelar</button>
              <button tuiButton type="submit" appearance="primary">{{ editandoObsId() ? 'Atualizar' : 'Adicionar' }}</button>
            </div>
          </form>

          <div class="confirm-box" *ngIf="modalTipo() === 'confirmar-arquivar' || modalTipo() === 'confirmar-anotacao' || modalTipo() === 'confirmar-observacao'">
            <p>{{ confirmacaoTexto() }}</p>
            <small *ngIf="modalTipo() === 'confirmar-arquivar'">O processo será arquivado e ficará disponível na seção Arquivados.</small>
            <div class="modal-actions">
              <button tuiButton type="button" appearance="secondary" (click)="fecharModal()">Cancelar</button>
              <button tuiButton type="button" appearance="destructive" (click)="executarAcaoConfirmada()">Confirmar</button>
            </div>
          </div>

        </section>
      </div>
    </section>

  `,
  styles: [`
    .process-page { display: grid; gap: 1rem; color: var(--color-text-strong); padding: 1.5rem; width: min(100%, 1500px); margin: 0 auto; }
    .page-hero, .modal__header, .notes-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    h1, h2, h3 { margin: 0; color: var(--color-text-strong); } h1 { font-size: 1.8rem; } h2 { font-size: 1.08rem; } h3 { font-size: 1rem; }
    .eyebrow { margin: 0 0 .25rem; color: var(--color-text-body); font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
    .subtitle, .empty, .description p, .confirm-box small { margin: .3rem 0 0; color: var(--color-text-body); line-height: 1.45; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: .75rem; }
    .summary-grid article, .filters, .process-card, .unit-block { background: #fff; border: 1px solid var(--color-card-border); border-radius: 8px; box-shadow: 0 12px 30px rgba(15, 23, 42, .08); }
    .summary-grid article { padding: .95rem; } .summary-grid span { color: var(--color-text-body); font-size: .8rem; } .summary-grid strong { display: block; margin-top: .2rem; font-size: 1.35rem; }
    .summary-grid .critical-summary { border-color: rgba(180, 35, 24, .32); background: linear-gradient(180deg, #fff 0%, #fff7f5 100%); }
    .summary-grid .critical-summary strong { color: #b42318; }
    .filters { display: grid; grid-template-columns: minmax(220px, 1fr) repeat(4, minmax(150px, 190px)) auto; gap: .75rem; padding: 1rem; }
    input, select, textarea { width: 100%; min-height: 38px; padding: .55rem .65rem; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #1f2937; font: inherit; }
    .content-grid { display: grid; grid-template-columns: 8fr 4fr; gap: 1rem; align-items: start; }
    .col-8 { min-width: 0; }
    .col-4 { min-width: 0; }
    .unit-list { display: grid; gap: 1rem; }
    .unit-block { overflow: hidden; }
    .unit-block__header { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: 1rem; border-bottom: 1px solid var(--color-card-border); background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); }
    .unit-block__header span, .unit-block__stats span { color: var(--color-text-body); font-size: .82rem; }
    .unit-block__stats { display: grid; place-items: center; min-width: 92px; min-height: 68px; border: 1px solid var(--color-card-border); border-radius: 8px; background: #fff; }
    .unit-block__stats strong { font-size: 1.5rem; color: var(--color-primary); }
    button[tuiButton] { display: inline-flex; align-items: center; justify-content: center; gap: .4rem; min-height: 34px; border-radius: 6px; border: 1px solid transparent; font-weight: 800; line-height: 1; white-space: nowrap; opacity: 1; visibility: visible; }
    button[tuiButton] tui-icon { display: inline-grid; color: currentColor; font-size: 1rem; }
    button[tuiButton][appearance="primary"] { background: var(--color-primary) !important; border-color: var(--color-primary) !important; color: #fff !important; }
    button[tuiButton][appearance="primary"]:hover { background: var(--color-primary-hover) !important; border-color: var(--color-primary-hover) !important; }
    button[tuiButton][appearance="secondary"] { background: #fff !important; border-color: var(--color-border) !important; color: var(--color-text-primary) !important; box-shadow: 0 1px 2px rgba(33, 47, 51, .08); }
    button[tuiButton][appearance="secondary"]:hover { background: var(--color-primary-soft) !important; border-color: rgba(82, 140, 156, .42) !important; color: var(--color-primary-hover) !important; }
    button[tuiButton][appearance="destructive"] { background: var(--color-error-soft) !important; border-color: rgba(156, 102, 78, .34) !important; color: var(--color-error) !important; }
    button[tuiButton][appearance="destructive"]:hover { background: var(--color-error) !important; border-color: var(--color-error) !important; color: #fff !important; }
    .process-list { display: grid; gap: .75rem; padding: 1rem; background: #f8fafc; }
    .process-card { overflow: hidden; border-left: 8px solid var(--color-primary); box-shadow: none; }
    .process-card:nth-child(even) { border-left-color: var(--color-secondary); }
    .process-card.priority-card-high { border-left-width: 12px; border-left-color: #c56a22; box-shadow: 0 10px 24px rgba(181, 71, 8, .12); }
    .process-card.priority-card-critical { border-left-width: 14px; border-left-color: #b42318; box-shadow: 0 12px 28px rgba(180, 35, 24, .18); }
    .process-card.priority-card-critical .process-card__main { background: linear-gradient(90deg, #fff4f2 0%, #fff 34%); }
    .process-card.priority-card-high .process-card__main { background: linear-gradient(90deg, #fff8ed 0%, #fff 34%); }
    .process-card__main { width: 100%; display: grid; grid-template-columns: minmax(260px, 1fr) minmax(300px, .9fr) minmax(190px, 220px); gap: 1rem; padding: 1rem; border: 0; background: #fff; color: inherit; text-align: left; cursor: pointer; box-sizing: border-box; }
    .process-card:nth-child(odd) .process-card__main { background: #ffffff; }
    .process-card:nth-child(even) .process-card__main { background: #fffdfa; }
    .process-card:nth-child(odd) .process-card__details { background: var(--color-primary-soft); }
    .process-card:nth-child(even) .process-card__details { background: var(--color-warning-soft); }
    .process-card__title { display: grid; gap: .35rem; align-content: start; } .process-card__title p { margin: 0; color: var(--color-text-body); line-height: 1.4; }
    .process-description { white-space: pre-wrap; overflow-wrap: anywhere; }
    .process-card__meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .55rem; } .process-card__meta span, .detail-grid div { display: grid; gap: .18rem; min-width: 0; }
    .process-card__meta strong, .detail-grid strong { color: var(--color-text-body); font-size: .72rem; text-transform: uppercase; } .process-card__meta span { color: var(--color-text-strong); font-weight: 700; }
    .process-card__actions { display: grid; gap: .45rem; align-content: start; justify-items: stretch; }
    .process-card__actions .priority, .process-card__actions .deadline-badge { justify-self: start; }
    .process-card__actions button[tuiButton] { width: 100%; min-width: 0; }
    .note-actions, .modal-actions, .detail-actions { display: flex; gap: .45rem; flex-wrap: wrap; align-items: center; justify-content: flex-end; }
    .process-card__details { display: grid; gap: 1rem; padding: 1rem; border-top: 1px solid var(--color-card-border); background: #f8fafc; }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: .75rem; } .detail-grid div { padding: .75rem; border: 1px solid var(--color-card-border); border-radius: 8px; background: #fff; }
    .description { display: grid; gap: .35rem; padding: .9rem; border: 1px solid var(--color-card-border); border-radius: 8px; background: #fff; }
    .note-list { display: grid; gap: .7rem; } .note { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .75rem; padding: .85rem; border: 1px solid var(--color-card-border); border-radius: 8px; background: #fff; }
    .note span { display: block; margin-top: .2rem; color: var(--color-text-body); font-size: .78rem; } .note-content { margin: .45rem 0 0; color: var(--color-text-body); line-height: 1.45; }
    .note-content ::ng-deep p { margin: .35rem 0; } .note-content ::ng-deep ul { margin: .35rem 0 .35rem 1.2rem; padding: 0; }
    .badge, .priority { display: inline-flex; width: fit-content; align-items: center; gap: .3rem; min-height: 24px; padding: 0 .55rem; border-radius: 999px; font-size: .72rem; font-weight: 800; white-space: nowrap; }
    .badge { background: #eef2ff; color: #3538cd; } .status-open { background: #eff8ff; color: #175cd3; } .status-progress { background: #ecfdf3; color: #027a48; } .status-paused { background: #fffaeb; color: #b54708; } .status-done { background: var(--color-surface-muted); color: var(--color-text-body); } .status-canceled { background: #fef3f2; color: #b42318; } .status-archived { background: #f1f5f9; color: #64748b; }
    .priority { background: var(--color-surface-muted); color: var(--color-text-body); }
    .priority tui-icon { font-size: .9rem; color: currentColor; }
    .priority-high { min-height: 30px; padding: 0 .75rem; background: #fff4e5; color: #9a4b08; border: 1px solid rgba(181, 71, 8, .28); box-shadow: 0 3px 10px rgba(181, 71, 8, .12); }
    .priority-critical { min-height: 32px; padding: 0 .8rem; background: #fee4e2; color: #b42318; border: 1px solid rgba(180, 35, 24, .35); box-shadow: 0 4px 12px rgba(180, 35, 24, .18); text-transform: uppercase; }
    .deadline-badge { display: inline-flex; width: fit-content; align-items: center; min-height: 26px; padding: 0 .65rem; border-radius: 999px; font-size: .72rem; font-weight: 900; white-space: nowrap; border: 1px solid transparent; }
    .deadline-ok { background: #ecfdf3; color: #027a48; border-color: #abefc6; }
    .deadline-today { background: #fffaeb; color: #b54708; border-color: #fedf89; }
    .deadline-late { background: #fef3f2; color: #b42318; border-color: #fecdca; }
    .detail-priority-high { border-color: rgba(181, 71, 8, .32) !important; background: #fff8ed !important; }
    .detail-priority-critical { border-color: rgba(180, 35, 24, .36) !important; background: #fff4f2 !important; }
    .detail-priority-high span { color: #9a4b08; font-weight: 900; }
    .detail-priority-critical span { color: #b42318; font-weight: 900; text-transform: uppercase; }
    .modal-backdrop { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 1rem; background: rgba(15,23,42,.48); }
    .modal { width: min(1100px, 96vw); max-height: 92vh; overflow: auto; background: #fff; border-radius: 10px; border: 1px solid var(--color-card-border); box-shadow: 0 24px 70px rgba(15,23,42,.28); }
    .modal__header { padding: 1rem; border-bottom: 1px solid var(--color-card-border); } .modal-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .85rem; padding: 1rem; }
    label { display: grid; gap: .35rem; color: var(--color-text-body); font-size: .82rem; font-weight: 700; } .wide { grid-column: 1 / -1; } .modal-actions { justify-content: flex-end; }
    .confirm-box { display: grid; gap: 1rem; padding: 1rem; } .feedback { color: #027a48; } .error { color: #b42318; }
    .empty-main { padding: 1rem; border: 1px dashed var(--color-card-border); border-radius: 8px; text-align: center; background: #fff; }
    .obs-panel { background: #fff; border: 1px solid var(--color-card-border); border-radius: 8px; box-shadow: 0 12px 30px rgba(15,23,42,.08); overflow: hidden; position: sticky; top: 1rem; max-height: calc(100vh - 2rem); display: flex; flex-direction: column; }
    .obs-panel__header { display: flex; justify-content: space-between; align-items: center; gap: .75rem; padding: 1rem; border-bottom: 1px solid var(--color-card-border); background: linear-gradient(180deg,#fff 0%,#f8fafc 100%); flex-shrink: 0; }
    .obs-panel__header h2 { font-size: 1rem; }
    .obs-list { display: grid; gap: .65rem; padding: .85rem; overflow-y: auto; flex: 1; }
    .obs-card { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: .5rem; padding: .8rem; border: 1px solid var(--color-card-border); border-left: 5px solid var(--color-secondary); border-radius: 8px; background: #fff; }
    .obs-card__body { display: grid; gap: .25rem; min-width: 0; }
    .obs-card__body strong { font-size: .9rem; color: var(--color-text-strong); overflow-wrap: anywhere; }
    .obs-meta { color: var(--color-text-body); font-size: .72rem; }
    .obs-content { margin-top: .3rem; color: var(--color-text-body); font-size: .82rem; line-height: 1.45; overflow-wrap: anywhere; }
    .obs-content ::ng-deep p { margin: .25rem 0; }
    .obs-actions { display: flex; flex-direction: column; gap: .35rem; align-items: flex-end; flex-shrink: 0; }
    @media (max-width: 1120px) { .content-grid { grid-template-columns: 1fr; } .obs-panel { position: static; max-height: none; } .process-card__main { grid-template-columns: 1fr; } .process-card__actions { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); } .process-card__actions .priority { align-self: center; } .filters { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 680px) { .process-page { padding: 1rem; } .page-hero, .note, .unit-block__header { display: grid; } .filters, .modal-form, .process-card__meta { grid-template-columns: 1fr; } }
  `],
})
export class ProcessosPageComponent {
  private readonly processoService = inject(ProcessoService);
  private readonly anotacaoService = inject(AnotacaoService);
  private readonly observacaoService = inject(ObservacaoService);
  private readonly unidadeService = inject(UnidadeSondaService);
  private readonly setorService = inject(SetorService);
  private readonly regionalService = inject(RegionalService);
  private readonly projetoService = inject(ProjetoService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly currentUser = this.store.selectSignal(AuthState.currentUser);
  protected readonly unidades = signal<UnidadeSonda[]>([]);
  protected readonly setores = signal<Setor[]>([]);
  protected readonly regionais = signal<Regional[]>([]);
  protected readonly processos = signal<Processo[]>([]);
  protected readonly projetos = signal<Projeto[]>([]);
  protected readonly usuariosInternos = signal<UsuarioResponse[]>([]);
  protected readonly expandidos = signal<Set<number>>(new Set());
  protected readonly observacoes = signal<Observacao[]>([]);
  protected readonly editandoObsId = signal<number | null>(null);
  protected readonly obsAtual = signal<Observacao | null>(null);
  protected readonly obsForm: ObservacaoPayload = { titulo: '', texto: '', setorId: 0 };
  protected readonly obsTexto = signal('');
  protected readonly projetosExpandidos = signal<Set<number>>(new Set());
  protected readonly anotacoesPorProcesso = signal<Record<number, Anotacao[]>>({});
  protected readonly modalTipo = signal<ModalTipo>(null);
  protected readonly processoAtual = signal<Processo | null>(null);
  protected readonly anotacaoAtual = signal<Anotacao | null>(null);
  protected readonly editandoId = signal<number | null>(null);
  protected readonly editandoAnotacaoId = signal<number | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly statusOptions: StatusProcesso[] = ['ABERTO', 'EM_ANDAMENTO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO'];
  protected readonly prioridadeOptions: Prioridade[] = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];
  protected readonly filtros: ProcessoFiltros = { texto: '', status: '', prioridade: '', setorId: '', unidadeSondaId: '', projetoId: '', responsavelUsername: '' };
  protected readonly form: ProcessoPayload = this.vazio();
  protected readonly anotacaoForm: AnotacaoPayload = { titulo: '', texto: '' };
  protected readonly formUnidadeId = signal<number>(0);
  protected readonly formSetorId = signal<number>(0);
  protected readonly formRegionalId = signal<number>(0);

  protected readonly setorRestritoIds = computed(() => {
    const user = this.currentUser();
    if (!user || user.roles.includes('ADMIN')) return [];
    if (!user.roles.includes('INTERNO')) return [];
    const regionalId = user.regionalId;
    if (!regionalId) return [];
    return this.setores().filter((s) => s.regionalId === regionalId).map((s) => s.id);
  });
  protected readonly totalAltaPrioridade = computed(() => this.processos().filter((p) => p.prioridade === 'ALTA' || p.prioridade === 'CRITICA').length);
  protected readonly processosPorProjeto = computed<GrupoProjetoProcessos[]>(() => {
    const projetosPorId = new Map(this.projetos().map((projeto) => [projeto.id, projeto]));
    const grupos = new Map<number, GrupoProjetoProcessos>();

    this.processos().forEach((processo) => {
      const projetoId = processo.projetoId ?? 0;
      const projeto = projetosPorId.get(projetoId);
      const grupo = grupos.get(projetoId) ?? {
        projetoId,
        projetoNome: processo.projetoNome || projeto?.nome || 'Sem projeto',
        setorNome: projeto?.regionalNome || processo.setorNome || '-',
        processos: [] as Processo[],
      };

      grupo.processos.push(processo);
      grupos.set(projetoId, grupo);
    });

    return Array.from(grupos.values()).sort((a, b) => a.projetoNome.localeCompare(b.projetoNome));
  });
  // Regionais disponíveis para o modal: ADMIN vê todas, INTERNO vê só a sua
  protected readonly regionaisDoModal = computed(() => {
    const user = this.currentUser();
    if (!user || user.roles.includes('ADMIN')) return this.regionais();
    const regionalId = user.regionalId;
    return regionalId ? this.regionais().filter((r) => r.id === regionalId) : [];
  });

  // Setores filtrados pela regional selecionada no modal
  protected readonly setoresDoModal = computed(() => {
    const regionalId = this.formRegionalId();
    if (!regionalId) return [];
    return this.setores().filter((s) => s.regionalId === regionalId);
  });

  protected readonly unidadesDoModal = computed(() => {
    const setorId = this.formSetorId();
    if (!setorId) return [];
    return this.unidades().filter((u) => u.setorId === setorId);
  });
  protected readonly responsaveisDisponiveis = computed(() => {
    const unidade = this.unidades().find((u) => u.id === this.formUnidadeId());
    const setorId = unidade?.setorId ?? this.formSetorId();
    const setor = this.setores().find((s) => s.id === setorId);
    return this.filtrarUsuariosPorRegional(this.usuariosInternos(), setor?.regionalId);
  });
  protected readonly responsaveisFiltro = computed(() => {
    const setorId = Number(this.filtros.setorId);
    const unidade = this.unidades().find((u) => u.id === Number(this.filtros.unidadeSondaId));
    const setorIdEfetivo = unidade?.setorId || setorId || null;
    const setor = setorIdEfetivo ? this.setores().find((s) => s.id === setorIdEfetivo) : null;
    return this.filtrarUsuariosPorRegional(this.usuariosInternos(), setor?.regionalId);
  });
  protected readonly projetosDisponiveis = computed(() => {
    const unidade = this.unidades().find((u) => u.id === this.formUnidadeId());
    const setorId = unidade?.setorId ?? this.formSetorId();
    const setor = this.setores().find((s) => s.id === setorId);
    const regionalId = setor?.regionalId;
    return regionalId ? this.projetos().filter((projeto) => projeto.regionalId === regionalId) : this.projetos();
  });
  protected readonly setoresDisponiveisFiltro = computed(() => {
    const setorIds = this.setorRestritoIds();
    return this.setores().filter((setor) => !setorIds.length || setorIds.includes(setor.id));
  });
  protected readonly unidadesDisponiveisFiltro = computed(() => {
    const setorId = Number(this.filtros.setorId);
    return this.unidades().filter((unidade) => !setorId || unidade.setorId === setorId);
  });
  protected readonly projetosDisponiveisFiltro = computed(() => {
    const unidade = this.unidades().find((u) => u.id === Number(this.filtros.unidadeSondaId));
    const setorId = Number(this.filtros.setorId);
    const setorIds = unidade?.setorId ? [unidade.setorId] : setorId ? [setorId] : this.setorRestritoIds();
    if (!setorIds.length) return this.projetos();
    const regionalIds = new Set(
      this.setores()
        .filter((s) => setorIds.includes(s.id))
        .map((s) => s.regionalId),
    );
    return this.projetos().filter((projeto) => !regionalIds.size || regionalIds.has(projeto.regionalId));
  });

  constructor() {
    this.carregarTudo();
  }

  protected carregarTudo(): void {
    this.setorService.listar().subscribe({ next: (setores) => this.setores.set(setores), error: (error: Error) => this.notificarErro(error) });
    this.regionalService.listar().subscribe({ next: (regionais) => this.regionais.set(regionais), error: (error: Error) => this.notificarErro(error) });
    const user = this.currentUser();
    if (user?.roles.includes('ADMIN')) {
      this.usuariosService.listar(0, 200).subscribe({ next: (pagina) => this.usuariosInternos.set(pagina.conteudo.filter((u) => u.roles.includes('INTERNO'))), error: (error: Error) => this.notificarErro(error) });
    }
    this.projetoService.listar().subscribe({ next: (projetos) => this.projetos.set(projetos), error: (error: Error) => this.notificarErro(error) });
    this.carregarUnidades();
    this.carregarProcessos();
    this.carregarObservacoes();
  }

  protected carregarObservacoes(): void {
    const setorIds = this.setorRestritoIds();
    const obs$ = setorIds.length
      ? this.observacaoService.listarPorSetores(setorIds)
      : this.observacaoService.listarPorSetores([]);
    obs$.subscribe({ next: (obs) => this.observacoes.set(obs), error: (e: Error) => this.notificarErro(e) });
  }

  protected carregarUnidades(): void {
    const setorIds = this.setorRestritoIds();
    this.unidadeService.listar(setorIds.length ? setorIds : null).subscribe({ next: (unidades) => this.unidades.set(unidades), error: (error: Error) => this.notificarErro(error) });
  }

  protected carregarProcessos(): void {
    const setorIds = this.setorRestritoIds();
    const filtros = { ...this.filtros, setorIds: setorIds.length ? setorIds : undefined };
    this.processoService.listar(filtros).subscribe({
      next: (processos) => this.processos.set(processos.filter((processo) => processo.statusProcesso !== 'ARQUIVADO')),
      error: (error: Error) => this.notificarErro(error),
    });
  }

  protected alternarProjeto(projetoId: number): void {
    const proximos = new Set(this.projetosExpandidos());
    proximos.has(projetoId) ? proximos.delete(projetoId) : proximos.add(projetoId);
    this.projetosExpandidos.set(proximos);
  }

  protected sincronizarProjetoFiltro(): void {
    if (this.filtros.projetoId && !this.projetosDisponiveisFiltro().some((projeto) => projeto.id === Number(this.filtros.projetoId))) {
      this.filtros.projetoId = '';
    }
  }

  protected sincronizarFiltrosSetor(): void {
    if (this.filtros.unidadeSondaId && !this.unidadesDisponiveisFiltro().some((unidade) => unidade.id === Number(this.filtros.unidadeSondaId))) {
      this.filtros.unidadeSondaId = '';
    }
    this.sincronizarProjetoFiltro();
  }

  protected projetoExpandido(projetoId: number): boolean {
    return this.projetosExpandidos().has(projetoId);
  }

  protected alternarExpansao(processo: Processo): void {
    const proximos = new Set(this.expandidos());
    proximos.has(processo.id) ? proximos.delete(processo.id) : proximos.add(processo.id);
    this.expandidos.set(proximos);
    if (proximos.has(processo.id)) this.carregarAnotacoes(processo.id);
  }

  protected expandido(id: number): boolean {
    return this.expandidos().has(id);
  }

  protected anotacoesDoProcesso(processoId: number): Anotacao[] {
    return this.anotacoesPorProcesso()[processoId] ?? [];
  }

  protected abrirProcesso(processo?: Processo): void {
    this.editandoId.set(processo?.id ?? null);
    this.processoAtual.set(processo ?? null);
    Object.assign(this.form, processo ? this.payloadDeProcesso(processo) : this.vazio());
    this.formSetorId.set(Number(this.form.setorId) || 0);
    this.formUnidadeId.set(Number(this.form.unidadeSondaId) || 0);
    // Pré-preencher regional: do processo ou da regional do usuário logado
    const user = this.currentUser();
    const regionalInicial = processo
      ? (this.setores().find((s) => s.id === processo.setorId)?.regionalId ?? 0)
      : (user?.regionalId ?? 0);
    this.formRegionalId.set(regionalInicial);
    this.modalTipo.set('processo');
  }

  protected abrirAnotacao(processo: Processo, anotacao?: Anotacao): void {
    this.processoAtual.set(processo);
    this.anotacaoAtual.set(anotacao ?? null);
    this.editandoAnotacaoId.set(anotacao?.id ?? null);
    Object.assign(this.anotacaoForm, anotacao ? { titulo: anotacao.titulo, texto: anotacao.texto } : { titulo: '', texto: '' });
    this.modalTipo.set('anotacao');
  }

  protected salvarProcesso(): void {
    this.sincronizarSetorPelaUnidade();
    if (!this.form.unidadeSondaId) { this.toast.warning('Preencha os campos obrigatórios.'); this.error.set('Selecione uma Unidade/Sonda.'); return; }
    if (!this.form.projetoId) { this.toast.warning('Preencha os campos obrigatórios.'); this.error.set('Selecione um Projeto.'); return; }
    const id = this.editandoId();
    const request = id ? this.processoService.atualizar(id, this.form) : this.processoService.criar(this.form);
    request.subscribe({
      next: () => {
        this.toast.success(id ? 'Processo atualizado com sucesso.' : 'Processo criado com sucesso.');
        this.fecharModal();
        this.carregarProcessos();
      },
      error: (error: Error) => this.notificarErro(error),
    });
  }

  protected salvarAnotacao(): void {
    const processo = this.processoAtual();
    if (!processo) return;
    if (!this.anotacaoForm.titulo?.trim() || this.anotacaoSemTexto()) {
      this.toast.warning('Preencha os campos obrigatórios.');
      return;
    }
    const id = this.editandoAnotacaoId();
    const request = id ? this.anotacaoService.atualizar(processo.id, id, this.anotacaoForm) : this.anotacaoService.criar(processo.id, this.anotacaoForm);
    request.subscribe({
      next: () => {
        this.toast.success(id ? 'Anotação atualizada com sucesso.' : 'Anotação criada com sucesso.');
        this.fecharModal();
        this.carregarAnotacoes(processo.id);
      },
      error: (error: Error) => this.notificarErro(error),
    });
  }

  protected confirmarArquivarProcesso(processo: Processo): void {
    this.processoAtual.set(processo);
    this.modalTipo.set('confirmar-arquivar');
  }

  protected confirmarExcluirAnotacao(processo: Processo, anotacao: Anotacao): void {
    this.processoAtual.set(processo);
    this.anotacaoAtual.set(anotacao);
    this.modalTipo.set('confirmar-anotacao');
  }

  protected executarAcaoConfirmada(): void {
    const processo = this.processoAtual();
    if (this.modalTipo() === 'confirmar-arquivar' && processo) {
      this.processoService.arquivar(processo.id).subscribe({
        next: () => { this.toast.success('Processo arquivado com sucesso.'); this.fecharModal(); this.carregarProcessos(); },
        error: (error: Error) => this.notificarErro(error),
      });
      return;
    }
    if (this.modalTipo() === 'confirmar-observacao') {
      const obs = this.obsAtual();
      if (obs) {
        this.observacaoService.excluir(obs.id).subscribe({
          next: () => { this.toast.success('Observação excluída.'); this.fecharModal(); this.carregarObservacoes(); },
          error: (e: Error) => this.notificarErro(e),
        });
      }
      return;
    }
    const anotacao = this.anotacaoAtual();
    if (processo && anotacao) {
      this.anotacaoService.excluir(processo.id, anotacao.id).subscribe({ next: () => { this.toast.success('Anotação excluída com sucesso.'); this.fecharModal(); this.carregarAnotacoes(processo.id); }, error: (error: Error) => this.notificarErro(error) });
    }
  }

  protected abrirObservacao(obs?: Observacao): void {
    this.editandoObsId.set(obs?.id ?? null);
    this.obsAtual.set(obs ?? null);
    const texto = obs?.texto ?? '';
    Object.assign(this.obsForm, obs
      ? { titulo: obs.titulo, texto, setorId: obs.setorId }
      : { titulo: '', texto: '', setorId: 0 });
    this.obsTexto.set(texto);
    this.modalTipo.set('observacao');
  }

  protected salvarObservacao(): void {
    this.obsForm.texto = this.obsTexto();
    const textoLimpo = this.obsForm.texto.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (!this.obsForm.titulo?.trim() || !textoLimpo) {
      this.toast.warning('Preencha o título e o conteúdo da observação.');
      return;
    }
    const id = this.editandoObsId();
    const req$ = id
      ? this.observacaoService.atualizar(id, this.obsForm)
      : this.observacaoService.criar(this.obsForm);
    req$.subscribe({
      next: () => {
        this.toast.success(id ? 'Observação atualizada.' : 'Observação criada.');
        this.fecharModal();
        this.carregarObservacoes();
      },
      error: (e: Error) => this.notificarErro(e),
    });
  }

  protected confirmarExcluirObservacao(obs: Observacao): void {
    this.obsAtual.set(obs);
    this.modalTipo.set('confirmar-observacao');
  }

  protected irParaArquivados(): void {
    this.router.navigate(['/app/gerenciamento/processos/arquivados']);
  }

  protected irParaResumo(): void {
    this.router.navigate(['/resumo-processos']);
  }

  protected aoTrocarRegionalModal(regionalId: number): void {
    this.formRegionalId.set(regionalId);
    this.form.setorId = 0;
    this.formSetorId.set(0);
    this.form.unidadeSondaId = 0;
    this.formUnidadeId.set(0);
    this.form.projetoId = null;
    this.form.responsavelUsername = null;
  }

  protected sincronizarModalAoTrocarSetor(): void {
    this.formSetorId.set(Number(this.form.setorId) || 0);
    this.form.unidadeSondaId = 0;
    this.formUnidadeId.set(0);
    this.form.projetoId = null;
    this.form.responsavelUsername = null;
  }

  protected sincronizarSetorPelaUnidade(): void {
    const unidade = this.unidades().find((item) => item.id === Number(this.form.unidadeSondaId));
    this.formUnidadeId.set(Number(this.form.unidadeSondaId) || 0);
    if (unidade?.setorId) {
      this.form.setorId = unidade.setorId;
      this.formSetorId.set(unidade.setorId);
    }
    if (this.form.projetoId && !this.projetosDisponiveis().some((projeto) => projeto.id === this.form.projetoId)) {
      this.form.projetoId = null;
    }
    if (this.form.responsavelUsername && !this.responsaveisDisponiveis().some((u) => u.username === this.form.responsavelUsername)) {
      this.form.responsavelUsername = null;
    }
  }

  private filtrarUsuariosPorRegional(usuarios: UsuarioResponse[], regionalId: number | undefined): UsuarioResponse[] {
    if (!regionalId) return usuarios;
    return usuarios.filter((u) => !u.regionalId || u.regionalId === regionalId);
  }

  protected fecharModal(): void {
    this.modalTipo.set(null);
    this.processoAtual.set(null);
    this.anotacaoAtual.set(null);
    this.obsAtual.set(null);
    this.editandoId.set(null);
    this.editandoAnotacaoId.set(null);
    this.editandoObsId.set(null);
    Object.assign(this.form, this.vazio());
    this.formSetorId.set(0);
    this.formUnidadeId.set(0);
    Object.assign(this.anotacaoForm, { titulo: '', texto: '' });
    Object.assign(this.obsForm, { titulo: '', texto: '', setorId: 0 });
    this.obsTexto.set('');
  }

  protected modalTituloEyebrow(): string { return this.modalTipo()?.startsWith('confirmar') ? 'Confirmação' : 'Gerenciamento'; }
  protected modalTitulo(): string {
    if (this.modalTipo() === 'processo') return this.editandoId() ? 'Editar Processo' : 'Novo Processo';
    if (this.modalTipo() === 'anotacao') return this.editandoAnotacaoId() ? 'Editar Anotação' : 'Nova Anotação';
    if (this.modalTipo() === 'observacao') return this.editandoObsId() ? 'Editar Observação' : 'Nova Observação';
    if (this.modalTipo() === 'confirmar-arquivar') return 'Arquivar Processo';
    if (this.modalTipo() === 'confirmar-observacao') return 'Excluir Observação';
    if (this.modalTipo() === 'resumo') return 'Resumo dos Processos';
    return 'Excluir Registro';
  }
  protected confirmacaoTexto(): string {
    if (this.modalTipo() === 'confirmar-arquivar') return `Arquivar o processo "${this.processoAtual()?.titulo}"?`;
    if (this.modalTipo() === 'confirmar-observacao') return `Excluir a observação "${this.obsAtual()?.titulo}"?`;
    return `Excluir a anotação "${this.anotacaoAtual()?.titulo}"?`;
  }

  protected totalPorStatus(status: StatusProcesso): number { return this.processos().filter((p) => p.statusProcesso === status).length; }
  protected statusLabel(status: StatusProcesso): string { return { ABERTO: 'Aberto', EM_ANDAMENTO: 'Em andamento', PAUSADO: 'Pausado', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado', ARQUIVADO: 'Arquivado' }[status]; }
  protected prioridadeLabel(prioridade: Prioridade): string { return { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' }[prioridade]; }
  protected statusClass(status: StatusProcesso): string { return { ABERTO: 'status-open', EM_ANDAMENTO: 'status-progress', PAUSADO: 'status-paused', CONCLUIDO: 'status-done', CANCELADO: 'status-canceled', ARQUIVADO: 'status-archived' }[status]; }
  protected prioridadeClass(prioridade: Prioridade): string { return prioridade === 'CRITICA' ? 'priority-critical' : prioridade === 'ALTA' ? 'priority-high' : ''; }
  protected prioridadeCardClass(prioridade: Prioridade): string { return prioridade === 'CRITICA' ? 'priority-card-critical' : prioridade === 'ALTA' ? 'priority-card-high' : ''; }
  protected prioridadeDetailClass(prioridade: Prioridade): string { return prioridade === 'CRITICA' ? 'detail-priority-critical' : prioridade === 'ALTA' ? 'detail-priority-high' : ''; }
  protected formatarDataHora(data?: string | null): string { return data ? new Date(data).toLocaleString('pt-BR') : '-'; }
  protected descricaoCompleta(texto?: string | null): string { return texto || 'Sem descrição informada.'; }

  protected prazoLabel(processo: Processo): string {
    const status = this.prazoStatus(processo);
    return status === 'late' ? 'Atrasado' : status === 'today' ? 'Termina hoje' : 'Em dia';
  }

  protected prazoClass(processo: Processo): string {
    const status = this.prazoStatus(processo);
    return status === 'late' ? 'deadline-late' : status === 'today' ? 'deadline-today' : 'deadline-ok';
  }

  protected carregarAnotacoes(processoId: number): void {
    this.anotacaoService.listarPorProcesso(processoId).subscribe({
      next: (anotacoes) => this.anotacoesPorProcesso.update((atual) => ({ ...atual, [processoId]: anotacoes })),
      error: (error: Error) => this.notificarErro(error),
    });
  }

  private notificarErro(error: Error): void {
    const message = error?.message || 'Não foi possível concluir a operação.';
    this.error.set(message);
    this.toast.error(message);
  }

  private anotacaoSemTexto(): boolean {
    const texto = this.anotacaoForm.texto.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    return !texto;
  }

  private prazoStatus(processo: Processo): 'ok' | 'today' | 'late' {
    if (!this.processoContaPrazo(processo)) return 'ok';
    const data = processo.dataPrevisaoConclusao?.slice(0, 10);
    if (!data) return 'ok';
    const hoje = this.hojeIso();
    if (data < hoje) return 'late';
    if (data === hoje) return 'today';
    return 'ok';
  }

  private processoContaPrazo(processo: Processo): boolean {
    return !['CONCLUIDO', 'CANCELADO', 'ARQUIVADO'].includes(processo.statusProcesso);
  }

  private hojeIso(): string {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  private vazio(): ProcessoPayload {
    return { titulo: '', descricao: '', statusProcesso: 'ABERTO', prioridade: 'MEDIA', setorId: 0, unidadeSondaId: 0, projetoId: null, responsavelUsername: null, centroCusto: '', dataInicio: '', dataPrevisaoConclusao: '', dataFim: '' };
  }

  private payloadDeProcesso(processo: Processo): ProcessoPayload {
    return {
      titulo: processo.titulo,
      descricao: processo.descricao ?? '',
      statusProcesso: processo.statusProcesso,
      prioridade: processo.prioridade,
      setorId: processo.setorId,
      unidadeSondaId: processo.unidadeSondaId ?? 0,
      projetoId: processo.projetoId ?? null,
      responsavelUsername: processo.responsavelUsername ?? null,
      centroCusto: processo.centroCusto ?? '',
      dataInicio: processo.dataInicio ? processo.dataInicio.slice(0, 16) : '',
      dataPrevisaoConclusao: processo.dataPrevisaoConclusao ? processo.dataPrevisaoConclusao.slice(0, 16) : '',
      dataFim: processo.dataFim ? processo.dataFim.slice(0, 16) : '',
    };
  }
}
