import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngxs/store';

import { ToastService } from '../../../../shared/toast/toast.service';
import { AuthState } from '../../../auth/state/auth.state';
import { UsuarioResponse } from '../../../usuarios/models/usuario-api.model';
import { UsuariosService } from '../../../usuarios/services/usuarios.service';
import { Projeto, ProjetoPayload, Setor } from '../../models/cadastros.model';
import { ProjetoService } from '../../services/projeto.service';
import { SetorService } from '../../services/setor.service';

@Component({
  selector: 'app-projetos-page',
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header class="page__header">
        <div><p>Cadastros</p><h1>Projetos</h1></div>
        <button type="button" (click)="novo()">Novo</button>
      </header>

      <form class="filters" (ngSubmit)="carregar()">
        <label>Setor
          <select name="filtroSetorId" [(ngModel)]="filtroSetorId">
            <option [ngValue]="null">Todos os setores permitidos</option>
            <option *ngFor="let setor of setoresDisponiveis()" [ngValue]="setor.id">{{ setor.nome }}</option>
          </select>
        </label>
        <button type="submit" class="ghost">Filtrar</button>
      </form>

      <p class="feedback" *ngIf="feedback()">{{ feedback() }}</p>
      <p class="error" *ngIf="error()">{{ error() }}</p>

      <form class="form" (ngSubmit)="salvar()">
        <label>Nome<input name="nome" [(ngModel)]="form.nome" required /></label>
        <label>Setor
          <select name="setorId" [(ngModel)]="form.setorId" required (ngModelChange)="sincronizarResponsavelAoTrocarSetor()">
            <option [ngValue]="0">Selecione</option>
            <option *ngFor="let setor of setoresDisponiveis()" [ngValue]="setor.id">{{ setor.nome }}</option>
          </select>
        </label>
        <label>Responsavel
          <select name="responsavelUsername" [(ngModel)]="form.responsavelUsername">
            <option [ngValue]="null">Sem responsavel</option>
            <option *ngFor="let usuario of responsaveisDisponiveis()" [ngValue]="usuario.username">{{ usuario.nome }} - {{ usuario.username }}</option>
          </select>
        </label>
        <label>Centro de custo<input name="centroCusto" [(ngModel)]="form.centroCusto" /></label>
        <label class="wide">Descricao<textarea name="descricao" rows="3" [(ngModel)]="form.descricao"></textarea></label>
        <div class="actions wide">
          <button type="submit">{{ editandoId() ? 'Atualizar' : 'Cadastrar' }}</button>
          <button type="button" class="ghost" (click)="novo()" *ngIf="editandoId()">Cancelar</button>
        </div>
      </form>

      <table>
        <thead><tr><th>Nome</th><th>Setor</th><th>Responsavel</th><th>Centro de custo</th><th>Acoes</th></tr></thead>
        <tbody>
          <tr *ngFor="let projeto of projetos()">
            <td><strong>{{ projeto.nome }}</strong><small>{{ projeto.descricao || '-' }}</small></td>
            <td>{{ projeto.setorNome }}</td>
            <td>{{ projeto.responsavelNome || projeto.responsavelUsername || '-' }}</td>
            <td>{{ projeto.centroCusto || '-' }}</td>
            <td class="row-actions">
              <button type="button" (click)="editar(projeto)">Editar</button>
              <button type="button" class="danger" (click)="excluir(projeto)">Excluir</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 1rem; color: var(--color-text-strong); padding: 1.5rem; width: min(100%, 1440px); margin: 0 auto; }
    .page__header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    h1 { margin: 0; font-size: 1.65rem; } p { margin: 0; color: var(--color-text-body); font-size: .8rem; }
    .form, .filters { display: grid; gap: .85rem; padding: 1rem; background: #fff; border: 1px solid var(--color-card-border); border-radius: 8px; }
    .form { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); } .filters { grid-template-columns: minmax(240px, 360px) auto; align-items: end; }
    label { display: grid; gap: .35rem; font-size: .82rem; color: var(--color-text-body); }
    input, select, textarea { min-height: 38px; padding: .55rem .65rem; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: var(--color-text-strong); font: inherit; }
    button { min-height: 36px; padding: 0 .85rem; border: 0; border-radius: 6px; background: var(--color-primary); color: #fff; cursor: pointer; font-weight: 800; }
    .ghost { background: var(--color-surface-muted); color: var(--color-text-strong); } .danger { background: #d92d20; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--color-card-border); border-radius: 8px; overflow: hidden; }
    th, td { padding: .75rem; border-bottom: 1px solid var(--color-surface-muted); text-align: left; color: var(--color-text-strong); vertical-align: top; }
    th { background: var(--color-surface-muted); color: var(--color-text-body); } small { display: block; margin-top: .25rem; color: var(--color-text-body); }
    .row-actions, .actions { display: flex; gap: .4rem; flex-wrap: wrap; align-items: end; } .wide { grid-column: 1 / -1; }
    .feedback { color: #027a48; } .error { color: #b42318; }
    @media (max-width: 760px) { .filters { grid-template-columns: 1fr; } }
  `],
})
export class ProjetosPageComponent {
  private readonly service = inject(ProjetoService);
  private readonly setorService = inject(SetorService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(Store);

  protected readonly currentUser = this.store.selectSignal(AuthState.currentUser);
  protected readonly projetos = signal<Projeto[]>([]);
  protected readonly setores = signal<Setor[]>([]);
  protected readonly usuariosInternos = signal<UsuarioResponse[]>([]);
  protected readonly editandoId = signal<number | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected filtroSetorId: number | null = null;
  protected readonly form: ProjetoPayload = { nome: '', descricao: '', centroCusto: '', setorId: 0, responsavelUsername: null };
  protected readonly formSetorId = signal<number>(0);

  protected readonly setoresDisponiveis = computed(() => {
    const user = this.currentUser();
    if (!user || user.roles.includes('ADMIN')) return this.setores();
    const ids = user.setorIds?.length ? user.setorIds : user.setorId ? [user.setorId] : [];
    return this.setores().filter((setor) => ids.includes(setor.id));
  });

  protected readonly responsaveisDisponiveis = computed(() => {
    const setorId = this.formSetorId();
    if (!setorId) return [];
    return this.usuariosInternos().filter((usuario) => {
      const ids = usuario.setorIds?.length ? usuario.setorIds : usuario.setorId ? [usuario.setorId] : [];
      return ids.includes(setorId);
    });
  });

  constructor() {
    this.setorService.listar().subscribe({ next: (setores) => this.setores.set(setores), error: (error: Error) => this.notificarErro(error) });
    this.usuariosService.listar(0, 200).subscribe({ next: (pagina) => this.usuariosInternos.set(pagina.conteudo.filter((u) => u.roles.includes('INTERNO'))), error: (error: Error) => this.notificarErro(error) });
    this.carregar();
  }

  protected carregar(): void {
    this.service.listar(this.filtroSetorId).subscribe({ next: (projetos) => this.projetos.set(projetos), error: (error: Error) => this.notificarErro(error) });
  }

  protected salvar(): void {
    if (!this.form.nome || !this.form.setorId) { this.toast.warning('Preencha os campos obrigatorios.'); return; }
    const id = this.editandoId();
    (id ? this.service.atualizar(id, this.form) : this.service.criar(this.form)).subscribe({
      next: () => { this.toast.success(id ? 'Projeto atualizado com sucesso.' : 'Projeto cadastrado com sucesso.'); this.novo(); this.carregar(); },
      error: (error: Error) => this.notificarErro(error),
    });
  }

  protected editar(projeto: Projeto): void {
    this.editandoId.set(projeto.id);
    Object.assign(this.form, {
      nome: projeto.nome,
      descricao: projeto.descricao ?? '',
      centroCusto: projeto.centroCusto ?? '',
      setorId: projeto.setorId,
      responsavelUsername: projeto.responsavelUsername ?? null,
    });
    this.formSetorId.set(projeto.setorId);
  }

  protected excluir(projeto: Projeto): void {
    if (!confirm(`Excluir projeto ${projeto.nome}?`)) return;
    this.service.excluir(projeto.id).subscribe({
      next: () => { this.toast.success('Projeto excluido com sucesso.'); this.carregar(); },
      error: (error: Error) => this.notificarErro(error),
    });
  }

  protected novo(): void {
    this.editandoId.set(null);
    Object.assign(this.form, { nome: '', descricao: '', centroCusto: '', setorId: 0, responsavelUsername: null });
    this.formSetorId.set(0);
  }

  protected sincronizarResponsavelAoTrocarSetor(): void {
    this.formSetorId.set(Number(this.form.setorId));
    if (this.form.responsavelUsername && !this.responsaveisDisponiveis().some((u) => u.username === this.form.responsavelUsername)) {
      this.form.responsavelUsername = null;
    }
  }

  private notificarErro(error: Error): void {
    const message = error?.message || 'Nao foi possivel concluir a operacao.';
    this.error.set(message);
    this.toast.error(message);
  }
}
