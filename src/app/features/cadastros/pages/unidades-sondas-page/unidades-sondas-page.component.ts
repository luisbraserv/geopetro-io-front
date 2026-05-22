import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ToastService } from '../../../../shared/toast/toast.service';
import { Setor, UnidadeSonda, UnidadeSondaPayload } from '../../models/cadastros.model';
import { SetorService } from '../../services/setor.service';
import { UnidadeSondaService } from '../../services/unidade-sonda.service';

@Component({
  selector: 'app-unidades-sondas-page',
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header class="page__header"><div><p>Cadastros</p><h1>Unidades/Sondas</h1></div><button type="button" (click)="novo()">Novo</button></header>
      <p class="feedback" *ngIf="feedback()">{{ feedback() }}</p><p class="error" *ngIf="error()">{{ error() }}</p>
      <form class="form" (ngSubmit)="salvar()">
        <label>Nome<input name="nome" [(ngModel)]="form.nome" required /></label>
        <label>Apelido<input name="apelido" [(ngModel)]="form.apelido" /></label>
        <label>Setor<select name="setorId" [(ngModel)]="form.setorId" required><option [ngValue]="0">Selecione</option><option *ngFor="let setor of setores()" [ngValue]="setor.id">{{ setor.nome }}</option></select></label>
        <div class="actions"><button type="submit">{{ editandoId() ? 'Atualizar' : 'Cadastrar' }}</button><button type="button" class="ghost" (click)="novo()" *ngIf="editandoId()">Cancelar</button></div>
      </form>
      <table>
        <thead><tr><th>Nome</th><th>Apelido</th><th>Setor</th><th>Ações</th></tr></thead>
        <tbody>
          <tr *ngFor="let unidade of unidades()"><td>{{ unidade.nome }}</td><td>{{ unidade.apelido || '-' }}</td><td>{{ unidade.setorNome }}</td><td class="row-actions"><button type="button" (click)="editar(unidade)">Editar</button><button type="button" class="danger" (click)="excluir(unidade)">Excluir</button></td></tr>
        </tbody>
      </table>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 1rem; color: var(--color-text-strong); padding: 1.5rem; width: min(100%, 1440px); margin: 0 auto; } .page__header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    h1 { margin: 0; font-size: 1.65rem; } p { margin: 0; color: var(--color-text-body); font-size: .8rem; } .form { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: .85rem; padding: 1rem; background: #fff; border: 1px solid var(--color-card-border); border-radius: 8px; }
    label { display: grid; gap: .35rem; font-size: .82rem; color: var(--color-text-body); } input, select { min-height: 38px; padding: .55rem .65rem; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: var(--color-text-strong); }
    button { min-height: 36px; padding: 0 .85rem; border: 0; border-radius: 6px; background: var(--color-primary); color: #fff; cursor: pointer; } .ghost { background: var(--color-surface-muted); color: #263040; } .danger { background: #d92d20; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--color-card-border); border-radius: 8px; overflow: hidden; } th, td { padding: .75rem; border-bottom: 1px solid var(--color-surface-muted); text-align: left; color: var(--color-text-strong); } th { background: var(--color-surface-muted); color: var(--color-text-body); }
    .row-actions, .actions { display: flex; gap: .4rem; flex-wrap: wrap; align-items: end; } .feedback { color: #027a48; } .error { color: #b42318; }
  `],
})
export class UnidadesSondasPageComponent {
  private readonly service = inject(UnidadeSondaService);
  private readonly setorService = inject(SetorService);
  private readonly toast = inject(ToastService);
  protected readonly unidades = signal<UnidadeSonda[]>([]);
  protected readonly setores = signal<Setor[]>([]);
  protected readonly editandoId = signal<number | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly form: UnidadeSondaPayload = { nome: '', apelido: '', setorId: 0 };

  constructor() { this.carregar(); this.setorService.listar().subscribe({ next: (setores) => this.setores.set(setores), error: (error: Error) => this.notificarErro(error) }); }

  protected salvar(): void {
    if (!this.form.setorId) { this.toast.warning('Preencha os campos obrigatórios.'); this.error.set('Selecione um setor.'); return; }
    const id = this.editandoId();
    (id ? this.service.atualizar(id, this.form) : this.service.criar(this.form)).subscribe({
      next: () => { this.toast.success(id ? 'Unidade/Sonda atualizada com sucesso.' : 'Unidade/Sonda cadastrada com sucesso.'); this.novo(); this.carregar(); },
      error: (error: Error) => this.notificarErro(error),
    });
  }

  protected editar(unidade: UnidadeSonda): void { this.editandoId.set(unidade.id); Object.assign(this.form, { nome: unidade.nome, apelido: unidade.apelido ?? '', setorId: unidade.setorId }); }
  protected excluir(unidade: UnidadeSonda): void { if (!confirm(`Excluir unidade/sonda ${unidade.nome}?`)) return; this.service.excluir(unidade.id).subscribe({ next: () => { this.toast.success('Unidade/Sonda excluída com sucesso.'); this.carregar(); }, error: (error: Error) => this.notificarErro(error) }); }
  protected novo(): void { this.editandoId.set(null); Object.assign(this.form, { nome: '', apelido: '', setorId: 0 }); }
  private carregar(): void { this.service.listar().subscribe({ next: (unidades) => this.unidades.set(unidades), error: (error: Error) => this.notificarErro(error) }); }
  private notificarErro(error: Error): void { const message = error?.message || 'Não foi possível concluir a operação.'; this.error.set(message); this.toast.error(message); }
}
