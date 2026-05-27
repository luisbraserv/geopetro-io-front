import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CepService } from '../../../../shared/services/cep.service';
import { ToastService } from '../../../../shared/toast/toast.service';
import { Empresa, EmpresaPayload } from '../../models/cadastros.model';
import { EmpresaService } from '../../services/empresa.service';

@Component({
  selector: 'app-empresas-page',
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header class="page__header">
        <div>
          <p class="eyebrow">Cadastros</p>
          <h1>Empresas</h1>
        </div>
        <button type="button" (click)="novo()">Novo</button>
      </header>

      <p class="feedback" *ngIf="feedback()">{{ feedback() }}</p>
      <p class="error" *ngIf="error()">{{ error() }}</p>

      <form class="form" (ngSubmit)="salvar()">
        <label>Nome<input name="nome" [(ngModel)]="form.nome" required /></label>
        <label>CNPJ<input name="cnpj" [(ngModel)]="form.cnpj" /></label>
        <label>Telefone<input name="telefone" [(ngModel)]="form.telefone" /></label>
        <label>Email<input name="email" [(ngModel)]="form.email" type="email" /></label>
        <label>CEP
          <div class="input-cep" [class.input-cep--loading]="buscandoCep()">
            <input name="cep" [(ngModel)]="form.cep" (blur)="buscarCep()" maxlength="9" placeholder="00000-000" />
            @if (buscandoCep()) { <span class="cep-spinner"></span> }
          </div>
          @if (buscandoCep()) { <span class="cep-feedback">Buscando endereÃ§o pelo CEP...</span> }
        </label>
        <label>Logradouro<input name="logradouro" [(ngModel)]="form.logradouro" [disabled]="buscandoCep()" /></label>
        <label>Bairro<input name="bairro" [(ngModel)]="form.bairro" [disabled]="buscandoCep()" /></label>
        <label>Cidade<input name="cidade" [(ngModel)]="form.cidade" [disabled]="buscandoCep()" /></label>
        <label>Estado<input name="estado" [(ngModel)]="form.estado" maxlength="2" [disabled]="buscandoCep()" /></label>
        <label>Número<input name="numero" [(ngModel)]="form.numero" /></label>
        <label class="span-2">Complemento<input name="complemento" [(ngModel)]="form.complemento" /></label>
        <div class="actions">
          <button type="submit">{{ editandoId() ? 'Atualizar' : 'Cadastrar' }}</button>
          @if (editandoId()) { <button type="button" class="ghost" (click)="novo()">Cancelar</button> }
        </div>
      </form>

      <table>
        <thead>
          <tr><th>Nome</th><th>CNPJ</th><th>Telefone</th><th>Email</th><th>Ações</th></tr>
        </thead>
        <tbody>
          @for (empresa of empresas(); track empresa.id) {
            <tr>
              <td>{{ empresa.nome }}</td>
              <td>{{ empresa.cnpj || '-' }}</td>
              <td>{{ empresa.telefone || '-' }}</td>
              <td>{{ empresa.email || '-' }}</td>
              <td class="row-actions">
                <button type="button" (click)="editar(empresa)">Editar</button>
                <button type="button" class="danger" (click)="excluir(empresa)">Excluir</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 1rem; color: var(--color-text-strong); padding: 1.5rem; width: min(100%, 1440px); margin: 0 auto; }
    .page__header { display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
    h1 { margin: 0; font-size: 1.65rem; } .eyebrow { margin: 0; color: var(--color-text-body); font-size: .8rem; }
    .form { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: .85rem; padding: 1rem; background: #fff; border: 1px solid var(--color-card-border); border-radius: 8px; }
    label { display: grid; gap: .35rem; font-size: .82rem; color: var(--color-text-body); }
    input, select, textarea { width: 100%; min-height: 38px; padding: .55rem .65rem; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: var(--color-text-strong); }
    .span-2 { grid-column: span 2; } .actions { display: flex; gap: .5rem; align-items: end; }
    button { min-height: 36px; padding: 0 .85rem; border: 0; border-radius: 6px; background: var(--color-primary); color: #fff; cursor: pointer; }
    button.ghost { background: var(--color-surface-muted); color: #263040; } button.danger { background: #d92d20; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--color-card-border); border-radius: 8px; overflow: hidden; }
    th, td { padding: .75rem; border-bottom: 1px solid var(--color-surface-muted); text-align: left; font-size: .9rem; color: var(--color-text-strong); }
    th { background: var(--color-surface-muted); color: var(--color-text-body); } .row-actions { display: flex; gap: .4rem; flex-wrap: wrap; }
    .input-cep { position: relative; display: flex; align-items: center; } .input-cep input { width: 100%; }
    .input-cep--loading input { padding-right: 2.2rem; }
    .cep-spinner { position: absolute; right: .65rem; width: 16px; height: 16px; border: 2px solid #cbd5e1; border-top-color: var(--color-primary); border-radius: 50%; animation: cep-spin .7s linear infinite; pointer-events: none; }
    .cep-feedback { color: var(--color-primary); font-size: .76rem; font-weight: 700; }
    input:disabled { background: #f1f5f9; color: #64748b; cursor: wait; }
    @keyframes cep-spin { to { transform: rotate(360deg); } }
    .feedback { color: #027a48; } .error { color: #b42318; } @media (max-width: 640px) { .span-2 { grid-column: auto; } }
  `],
})
export class EmpresasPageComponent {
  private readonly service = inject(EmpresaService);
  private readonly cepService = inject(CepService);
  private readonly toast = inject(ToastService);
  protected readonly empresas = signal<Empresa[]>([]);
  protected readonly buscandoCep = signal(false);
  protected readonly editandoId = signal<number | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly form: EmpresaPayload = this.vazio();

  constructor() {
    this.carregar();
  }

  protected salvar(): void {
    this.feedback.set(null);
    this.error.set(null);
    const id = this.editandoId();
    const request = id ? this.service.atualizar(id, this.form) : this.service.criar(this.form);
    request.subscribe({
      next: () => {
        this.toast.success(id ? 'Empresa atualizada com sucesso.' : 'Empresa cadastrada com sucesso.');
        this.novo();
        this.carregar();
      },
      error: (error: Error) => this.notificarErro(error),
    });
  }

  protected editar(empresa: Empresa): void {
    this.editandoId.set(empresa.id);
    Object.assign(this.form, empresa);
  }

  protected excluir(empresa: Empresa): void {
    if (!confirm(`Excluir empresa ${empresa.nome}?`)) return;
    this.service.excluir(empresa.id).subscribe({
      next: () => { this.toast.success('Empresa excluída com sucesso.'); this.carregar(); },
      error: (error: Error) => this.notificarErro(error),
    });
  }

  protected novo(): void {
    this.editandoId.set(null);
    Object.assign(this.form, this.vazio());
  }

  protected buscarCep(): void {
    if (!this.form.cep) return;
    this.buscandoCep.set(true);
    this.cepService.buscar(this.form.cep).subscribe({
      next: (end) => {
        this.form.logradouro = end.logradouro;
        this.form.bairro = end.bairro;
        this.form.cidade = end.localidade;
        this.form.estado = end.uf;
        this.buscandoCep.set(false);
      },
      error: (e: Error) => {
        this.toast.error(e.message || 'CEP não encontrado.');
        this.buscandoCep.set(false);
      },
    });
  }

  private carregar(): void {
    this.service.listar().subscribe({
      next: (empresas) => this.empresas.set(empresas),
      error: (error: Error) => this.notificarErro(error),
    });
  }

  private notificarErro(error: Error): void {
    const message = error?.message || 'Não foi possível concluir a operação.';
    this.error.set(message);
    this.toast.error(message);
  }

  private vazio(): EmpresaPayload {
    return { nome: '', cnpj: '', telefone: '', email: '', cep: '', logradouro: '', bairro: '', cidade: '', estado: '', numero: '', complemento: '' };
  }
}
