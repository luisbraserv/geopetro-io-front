import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiIcon } from '@taiga-ui/core';

import {
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

  protected readonly tipo = signal<TipoUsuario>('INTERNO');
  protected readonly usuarios = signal<UsuarioResponse[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly feedback = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly form = {
    id: 1,
    empresa: '',
    matricula: 100,
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
  };

  constructor() {
    this.listarUsuarios();
  }

  protected salvar(): void {
    this.isLoading.set(true);
    this.feedback.set(null);
    this.error.set(null);

    const request =
      this.tipo() === 'CLIENTE'
        ? this.usuariosService.criarCliente(this.payloadCliente())
        : this.usuariosService.criarInterno(this.payloadInterno());

    request.subscribe({
      next: () => {
        this.feedback.set('Usuário cadastrado com sucesso.');
        this.limparFormulario();
        this.listarUsuarios();
      },
      error: (error: Error) => {
        this.error.set(error.message);
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
        this.error.set(error.message);
        this.isLoading.set(false);
      },
    });
  }

  private payloadCliente(): CriarUsuarioClientePayload {
    return {
      ...this.payloadComum(),
      id: Number(this.form.id),
      empresa: this.form.empresa,
      username: this.form.username,
      password: this.form.password,
    };
  }

  private payloadInterno(): CriarUsuarioInternoPayload {
    return {
      ...this.payloadComum(),
      matricula: Number(this.form.matricula),
      setor: this.form.setor,
      username: this.form.username,
      password: this.form.password,
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

  private limparFormulario(): void {
    Object.assign(this.form, {
      username: '',
      password: '',
      nome: '',
      telefone: '',
      email: '',
      empresa: '',
      setor: '',
      cep: '',
      logradouro: '',
      bairro: '',
      cidade: '',
      estado: '',
      numero: '',
      complemento: '',
    });
  }
}
