import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiIcon } from '@taiga-ui/core';

import { CepService } from '../../../../shared/services/cep.service';
import { ToastService } from '../../../../shared/toast/toast.service';
import { UserRole } from '../../../auth/models/user.model';
import { Empresa, Setor } from '../../../cadastros/models/cadastros.model';
import { EmpresaService } from '../../../cadastros/services/empresa.service';
import { SetorService } from '../../../cadastros/services/setor.service';
import {
  AtualizarUsuarioPayload,
  CriarUsuarioClientePayload,
  CriarUsuarioInternoPayload,
  UsuarioResponse,
} from '../../models/usuario-api.model';
import { UsuariosService } from '../../services/usuarios.service';

type TipoUsuario = 'CLIENTE' | 'INTERNO';

@Component({
  selector: 'app-usuarios-admin-page',
  imports: [CommonModule, FormsModule, TuiButton, TuiIcon],
  templateUrl: './usuarios-admin-page.component.html',
  styleUrl: './usuarios-admin-page.component.css',
})
export class UsuariosAdminPageComponent {
  private readonly usuariosService = inject(UsuariosService);
  private readonly empresaService = inject(EmpresaService);
  private readonly setorService = inject(SetorService);
  private readonly cepService = inject(CepService);
  private readonly toast = inject(ToastService);

  protected readonly tipo = signal<TipoUsuario>('INTERNO');
  protected readonly usuarios = signal<UsuarioResponse[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly buscandoCep = signal(false);
  protected readonly feedback = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly editandoUsername = signal<string | null>(null);
  protected readonly empresas = signal<Empresa[]>([]);
  protected readonly setores = signal<Setor[]>([]);
  protected readonly rolesAdicionais: UserRole[] = ['ADMIN', 'CIMENTACAO', 'SONDA'];

  protected readonly form = {
    id: 1,
    empresaId: 0,
    empresa: '',
    matricula: 100,
    setorId: 0,
    setorIds: [] as number[],
    setor: '',
    username: '',
    password: '',
    nome: '',
    telefone: '',
    email: '',
    cep: '',
    logradouro: '',
    bairro: '',
    cidade: '',
    estado: '',
    numero: '',
    complemento: '',
    roles: [] as UserRole[],
  };

  constructor() {
    this.listarUsuarios();
    this.carregarRelacionamentos();
  }

  protected editando(): boolean {
    return this.editandoUsername() !== null;
  }

  protected selecionarTipo(tipo: TipoUsuario): void {
    if (this.editando()) {
      return;
    }

    this.tipo.set(tipo);
  }

  protected roleBase(): UserRole {
    return this.tipo();
  }

  protected roleSelecionada(role: UserRole): boolean {
    return this.form.roles.includes(role);
  }

  protected alternarRole(role: UserRole, checked: boolean): void {
    if (checked && !this.form.roles.includes(role)) {
      this.form.roles = [...this.form.roles, role];
      return;
    }

    if (!checked) {
      this.form.roles = this.form.roles.filter((item) => item !== role);
    }
  }

  protected setorSelecionado(setorId: number): boolean {
    return this.form.setorIds.includes(setorId);
  }

  protected alternarSetor(setor: Setor, checked: boolean): void {
    if (checked && !this.form.setorIds.includes(setor.id)) {
      this.form.setorIds = [...this.form.setorIds, setor.id];
    }

    if (!checked) {
      this.form.setorIds = this.form.setorIds.filter((id) => id !== setor.id);
    }

    this.form.setorId = this.form.setorIds[0] ?? 0;
    this.form.setor = this.setores()
      .filter((item) => this.form.setorIds.includes(item.id))
      .map((item) => item.nome)
      .join(', ');
  }

  protected roleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      ADMIN: 'Administrador',
      USER: 'Usuário',
      OPERADOR: 'Operador',
      ENGENHARIA: 'Engenharia',
      CLIENTE: 'Cliente',
      INTERNO: 'Interno',
      CIMENTACAO: 'Cimentação',
      SONDA: 'Sonda',
    };

    return labels[role] ?? role;
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

  protected salvar(): void {
    this.isLoading.set(true);
    this.feedback.set(null);
    this.error.set(null);

    if (this.tipo() === 'INTERNO' && this.form.setorIds.length === 0) {
      this.toast.warning('Preencha os campos obrigatórios.');
      this.error.set('Selecione ao menos um setor para o usuário interno.');
      this.isLoading.set(false);
      return;
    }

    const username = this.editandoUsername();
    const request = username
      ? this.usuariosService.atualizarUsuario(username, this.payloadAtualizacao())
      : this.tipo() === 'CLIENTE'
        ? this.usuariosService.criarCliente(this.payloadCliente())
        : this.usuariosService.criarInterno(this.payloadInterno());

    request.subscribe({
      next: () => {
        this.toast.success(username ? 'Usuário atualizado com sucesso.' : 'Usuário cadastrado com sucesso.');
        this.limparFormulario();
        this.listarUsuarios();
      },
      error: (error: Error) => {
        this.notificarErro(error);
        this.isLoading.set(false);
      },
    });
  }

  protected listarUsuarios(): void {
    this.usuariosService.listar(0, 20).subscribe({
      next: (pagina) => {
        this.usuarios.set(pagina.conteudo);
        this.isLoading.set(false);
      },
      error: (error: Error) => {
        this.notificarErro(error);
        this.isLoading.set(false);
      },
    });
  }

  protected editar(usuario: UsuarioResponse): void {
    this.feedback.set(null);
    this.error.set(null);
    this.editandoUsername.set(usuario.username);
    this.tipo.set(usuario.roles.includes('CLIENTE') ? 'CLIENTE' : 'INTERNO');

    Object.assign(this.form, {
      id: usuario.id ?? 1,
      empresaId: usuario.empresaId ?? 0,
      empresa: usuario.empresaNome ?? usuario.empresa ?? '',
      matricula: usuario.matricula ?? 100,
      setorId: usuario.setorIds?.[0] ?? usuario.setorId ?? 0,
      setorIds: usuario.setorIds?.length ? usuario.setorIds : usuario.setorId ? [usuario.setorId] : [],
      setor: usuario.setorNomes?.join(', ') || usuario.setorNome || usuario.setor || '',
      username: usuario.username,
      password: '',
      nome: usuario.nome,
      telefone: usuario.telefone,
      email: usuario.email,
      cep: usuario.cep ?? '',
      logradouro: usuario.logradouro ?? '',
      bairro: usuario.bairro ?? '',
      cidade: usuario.cidade ?? '',
      estado: usuario.estado ?? '',
      numero: usuario.numero ?? '',
      complemento: usuario.complemento ?? '',
      roles: usuario.roles.filter((role) => role !== 'CLIENTE' && role !== 'INTERNO'),
    });
  }

  protected cancelarEdicao(): void {
    this.limparFormulario();
  }

  private payloadCliente(): CriarUsuarioClientePayload {
    return {
      ...this.payloadComum(),
      id: Number(this.form.id),
      empresaId: Number(this.form.empresaId),
      empresa: this.form.empresa,
      username: this.form.username,
      password: this.form.password,
      roles: this.rolesSelecionadas(),
    };
  }

  private payloadInterno(): CriarUsuarioInternoPayload {
    return {
      ...this.payloadComum(),
      matricula: Number(this.form.matricula),
      setorId: Number(this.form.setorIds[0] ?? this.form.setorId),
      setorIds: this.form.setorIds.map(Number),
      setor: this.form.setor,
      username: this.form.username,
      password: this.form.password,
      roles: this.rolesSelecionadas(),
    };
  }

  private payloadAtualizacao(): AtualizarUsuarioPayload {
    return {
      ...this.payloadComum(),
      roles: this.rolesSelecionadas(),
      ...(this.tipo() === 'CLIENTE'
        ? { id: Number(this.form.id), empresaId: Number(this.form.empresaId), empresa: this.form.empresa }
        : { matricula: Number(this.form.matricula), setorId: Number(this.form.setorIds[0] ?? this.form.setorId), setorIds: this.form.setorIds.map(Number), setor: this.form.setor }),
    };
  }

  private payloadComum() {
    return {
      nome: this.form.nome,
      telefone: this.form.telefone,
      email: this.form.email,
      cep: this.form.cep,
      logradouro: this.form.logradouro,
      bairro: this.form.bairro,
      cidade: this.form.cidade,
      estado: this.form.estado,
      numero: this.form.numero,
      complemento: this.form.complemento,
    };
  }

  private rolesSelecionadas(): UserRole[] {
    return Array.from(new Set<UserRole>([this.roleBase(), ...this.form.roles]));
  }

  private limparFormulario(): void {
    this.editandoUsername.set(null);
    this.tipo.set('INTERNO');
    Object.assign(this.form, {
      id: 1,
      empresaId: 0,
      empresa: '',
      matricula: 100,
      setorId: 0,
      setorIds: [],
      setor: '',
      username: '',
      password: '',
      nome: '',
      telefone: '',
      email: '',
      cep: '',
      logradouro: '',
      bairro: '',
      cidade: '',
      estado: '',
      numero: '',
      complemento: '',
      roles: [],
    });
  }

  private carregarRelacionamentos(): void {
    this.empresaService.listar().subscribe({
      next: (empresas) => this.empresas.set(empresas),
      error: (error: Error) => this.notificarErro(error),
    });
    this.setorService.listar().subscribe({
      next: (setores) => this.setores.set(setores),
      error: (error: Error) => this.notificarErro(error),
    });
  }

  private notificarErro(error: Error): void {
    const message = error?.message || 'Não foi possível concluir a operação.';
    this.error.set(message);
    this.toast.error(message);
  }
}
