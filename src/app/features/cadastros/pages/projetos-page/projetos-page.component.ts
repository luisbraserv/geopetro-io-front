import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngxs/store';

import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PaginatorComponent } from '../../../../shared/ui/paginator/paginator.component';
import { SearchBoxComponent } from '../../../../shared/ui/search-box/search-box.component';
import { ToastService } from '../../../../shared/toast/toast.service';
import { AuthState } from '../../../auth/state/auth.state';
import { UsuarioResponse } from '../../../usuarios/models/usuario-api.model';
import { UsuariosService } from '../../../usuarios/services/usuarios.service';
import { Projeto, ProjetoPayload, Regional, Setor } from '../../models/cadastros.model';
import { ProjetoService } from '../../services/projeto.service';
import { RegionalService } from '../../services/regional.service';
import { SetorService } from '../../services/setor.service';

@Component({
  selector: 'app-projetos-page',
  imports: [FormsModule, ModalComponent, SearchBoxComponent, PaginatorComponent],
  template: `
    <section class="page">
      <header class="page__header">
        <div><p>Cadastros</p><h1>Projetos</h1></div>
        <div class="header-actions">
          <app-search-box placeholder="Buscar projeto..." (busca)="aoBuscar($event)" />
          <button type="button" (click)="abrirNovo()">Novo</button>
        </div>
      </header>

      <form class="filters" (ngSubmit)="pagina.set(0); carregar()">
        <label>Regional
          <select name="filtroRegionalId" [(ngModel)]="filtroRegionalId">
            <option [ngValue]="null">Todas as regionais permitidas</option>
            @for (r of regionaisDisponiveis(); track r.id) {
              <option [ngValue]="r.id">{{ r.nome }}</option>
            }
          </select>
        </label>
        <button type="submit" class="ghost">Filtrar</button>
      </form>

      <app-modal [open]="modalAberto()" [title]="editandoId() ? 'Editar projeto' : 'Novo projeto'" width="760px" (close)="fecharModal()">
        @if (error()) { <p class="error">{{ error() }}</p> }
        <form id="form-projeto" class="form" (ngSubmit)="salvar()">
          <label>Nome <input name="nome" [(ngModel)]="form.nome" required /></label>
          <label>Regional
            <select name="regionalId" [(ngModel)]="form.regionalId" required (ngModelChange)="aoTrocarRegional()">
              <option [ngValue]="0">Selecione</option>
              @for (r of regionaisDisponiveis(); track r.id) {
                <option [ngValue]="r.id">{{ r.nome }}</option>
              }
            </select>
          </label>
          <label>Responsavel
            <select name="responsavelUsername" [(ngModel)]="form.responsavelUsername">
              <option [ngValue]="null">Sem responsavel</option>
              @for (usuario of responsaveisDisponiveis(); track usuario.username) {
                <option [ngValue]="usuario.username">{{ usuario.nome }} — {{ usuario.username }}</option>
              }
            </select>
          </label>
          <label>Centro de custo <input name="centroCusto" [(ngModel)]="form.centroCusto" /></label>
          <label class="wide">Descricao <textarea name="descricao" rows="3" [(ngModel)]="form.descricao"></textarea></label>
        </form>
        <ng-container modal-footer>
          <button type="button" class="ghost" (click)="fecharModal()">Cancelar</button>
          <button type="submit" form="form-projeto">{{ editandoId() ? 'Atualizar' : 'Cadastrar' }}</button>
        </ng-container>
      </app-modal>

      <table>
        <thead>
          <tr><th>Nome</th><th>Regional</th><th>Responsavel</th><th>Centro de custo</th><th>Acoes</th></tr>
        </thead>
        <tbody>
          @for (projeto of projetos(); track projeto.id) {
            <tr>
              <td><strong>{{ projeto.nome }}</strong><small>{{ projeto.descricao || '-' }}</small></td>
              <td>{{ projeto.regionalNome }}</td>
              <td>{{ projeto.responsavelNome || projeto.responsavelUsername || '-' }}</td>
              <td>{{ projeto.centroCusto || '-' }}</td>
              <td class="row-actions">
                <button type="button" (click)="editar(projeto)">Editar</button>
                <button type="button" class="danger" (click)="excluir(projeto)">Excluir</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="empty">Nenhum projeto encontrado.</td></tr>
          }
        </tbody>
      </table>

      <app-paginator [pagina]="pagina()" [totalPaginas]="totalPaginas()" [totalElementos]="totalElementos()" (mudarPagina)="irParaPagina($event)" />
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 1rem; color: var(--color-text-strong); padding: 1.5rem; width: min(100%, 1440px); margin: 0 auto; }
    .page__header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .header-actions { display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; }
    h1 { margin: 0; font-size: 1.65rem; } p { margin: 0; color: var(--color-text-body); font-size: .8rem; }
    .form, .filters { display: grid; gap: .85rem; padding: 1rem; background: #fff; border: 1px solid var(--color-card-border); border-radius: 8px; }
    .form { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); } .filters { grid-template-columns: minmax(240px, 360px) auto; align-items: end; }
    label { display: grid; gap: .35rem; font-size: .82rem; color: var(--color-text-body); }
    input, select, textarea { min-height: 38px; padding: .55rem .65rem; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: var(--color-text-strong); font: inherit; }
    button { min-height: 36px; padding: 0 .85rem; border: 0; border-radius: 6px; background: var(--color-primary); color: #fff; cursor: pointer; font-weight: 800; }
    .ghost { background: var(--color-surface-muted); color: var(--color-text-strong); } .danger { background: #d92d20; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--color-card-border); border-radius: 8px; overflow: hidden; }
    th, td { padding: .75rem; border-bottom: 1px solid var(--color-surface-muted); text-align: left; color: var(--color-text-strong); vertical-align: top; }
    th { background: var(--color-surface-muted); color: var(--color-text-body); font-size: .78rem; font-weight: 700; text-transform: uppercase; }
    small { display: block; margin-top: .25rem; color: var(--color-text-body); }
    .row-actions, .actions { display: flex; gap: .4rem; flex-wrap: wrap; align-items: end; }
    .wide { grid-column: 1 / -1; }
    .error { color: #b42318; font-size: .82rem; }
    .empty { text-align: center; color: var(--color-text-secondary); }
    @media (max-width: 760px) { .filters { grid-template-columns: 1fr; } }
  `],
})
export class ProjetosPageComponent {
  private readonly service = inject(ProjetoService);
  private readonly regionalService = inject(RegionalService);
  private readonly setorService = inject(SetorService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(Store);

  protected readonly currentUser = this.store.selectSignal(AuthState.currentUser);
  protected readonly projetos = signal<Projeto[]>([]);
  protected readonly regionais = signal<Regional[]>([]);
  protected readonly setores = signal<Setor[]>([]);
  protected readonly usuariosInternos = signal<UsuarioResponse[]>([]);
  protected readonly editandoId = signal<number | null>(null);
  protected readonly modalAberto = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly pagina = signal(0);
  protected readonly totalPaginas = signal(0);
  protected readonly totalElementos = signal(0);
  private busca = '';
  protected filtroRegionalId: number | null = null;
  protected form: ProjetoPayload = { nome: '', descricao: '', centroCusto: '', regionalId: 0, responsavelUsername: null };
  protected readonly formRegionalId = signal<number>(0);

  // Regionais acessíveis ao usuário (ADMIN vê todas; INTERNO vê somente a sua)
  protected readonly regionaisDisponiveis = computed(() => {
    const user = this.currentUser();
    if (!user || user.roles.includes('ADMIN')) return this.regionais();
    const regionalId = user.regionalId;
    return regionalId ? this.regionais().filter((r) => r.id === regionalId) : [];
  });

  // Responsáveis: usuários internos da mesma regional do projeto
  protected readonly responsaveisDisponiveis = computed(() => {
    const regionalId = this.formRegionalId();
    if (!regionalId) return [];
    return this.usuariosInternos().filter((u) => !u.regionalId || u.regionalId === regionalId);
  });

  constructor() {
    this.regionalService.listar().subscribe({ next: (r) => this.regionais.set(r), error: (err: Error) => this.notificarErro(err) });
    this.setorService.listar().subscribe({ next: (s) => this.setores.set(s), error: (err: Error) => this.notificarErro(err) });
    this.usuariosService.listar(0, 200).subscribe({
      next: (pagina) => this.usuariosInternos.set(pagina.conteudo.filter((u) => u.roles.includes('INTERNO'))),
      error: (err: Error) => this.notificarErro(err),
    });
    this.carregar();
  }

  protected carregar(): void {
    this.service.listarPaginado(this.pagina(), 10, this.busca, this.filtroRegionalId).subscribe({
      next: (p) => {
        this.projetos.set(p.conteudo);
        this.totalPaginas.set(p.totalPaginas);
        this.totalElementos.set(p.totalElementos);
      },
      error: (err: Error) => this.notificarErro(err),
    });
  }

  protected aoBuscar(termo: string): void { this.busca = termo; this.pagina.set(0); this.carregar(); }
  protected irParaPagina(p: number): void { this.pagina.set(p); this.carregar(); }

  protected abrirNovo(): void { this.novo(); this.modalAberto.set(true); }
  protected fecharModal(): void { this.modalAberto.set(false); this.novo(); }

  protected salvar(): void {
    if (!this.form.nome || !this.form.regionalId) { this.toast.warning('Preencha os campos obrigatorios.'); return; }
    const id = this.editandoId();
    (id ? this.service.atualizar(id, this.form) : this.service.criar(this.form)).subscribe({
      next: () => { this.toast.success(id ? 'Projeto atualizado com sucesso.' : 'Projeto cadastrado com sucesso.'); this.modalAberto.set(false); this.novo(); this.carregar(); },
      error: (err: Error) => this.notificarErro(err),
    });
  }

  protected editar(projeto: Projeto): void {
    this.editandoId.set(projeto.id);
    this.form = {
      nome: projeto.nome,
      descricao: projeto.descricao ?? '',
      centroCusto: projeto.centroCusto ?? '',
      regionalId: projeto.regionalId,
      responsavelUsername: projeto.responsavelUsername ?? null,
    };
    this.formRegionalId.set(projeto.regionalId);
    this.error.set(null);
    this.modalAberto.set(true);
  }

  protected excluir(projeto: Projeto): void {
    if (!confirm(`Excluir projeto "${projeto.nome}"?`)) return;
    this.service.excluir(projeto.id).subscribe({
      next: () => { this.toast.success('Projeto excluido com sucesso.'); this.carregar(); },
      error: (err: Error) => this.notificarErro(err),
    });
  }

  protected novo(): void {
    this.editandoId.set(null);
    this.form = { nome: '', descricao: '', centroCusto: '', regionalId: 0, responsavelUsername: null };
    this.formRegionalId.set(0);
    this.error.set(null);
  }

  protected aoTrocarRegional(): void {
    this.formRegionalId.set(Number(this.form.regionalId));
    if (this.form.responsavelUsername && !this.responsaveisDisponiveis().some((u) => u.username === this.form.responsavelUsername)) {
      this.form.responsavelUsername = null;
    }
  }

  private notificarErro(err: Error): void {
    const message = err?.message || 'Nao foi possivel concluir a operacao.';
    this.error.set(message);
    this.toast.error(message);
  }
}
