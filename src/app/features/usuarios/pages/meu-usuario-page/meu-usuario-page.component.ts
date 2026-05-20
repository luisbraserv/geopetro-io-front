import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core';
import { Store } from '@ngxs/store';

import { AuthState } from '../../../auth/state/auth.state';
import { UpdateAuthenticatedUser } from '../../../auth/state/auth.actions';
import { UsuariosService } from '../../services/usuarios.service';

@Component({
  selector: 'app-meu-usuario-page',
  imports: [CommonModule, FormsModule, TuiButton],
  templateUrl: './meu-usuario-page.component.html',
  styleUrl: './meu-usuario-page.component.css',
})
export class MeuUsuarioPageComponent {
  private readonly store = inject(Store);
  private readonly usuariosService = inject(UsuariosService);

  protected readonly currentUser = this.store.selectSignal(AuthState.currentUser);
  protected readonly isLoading = signal(false);
  protected readonly feedback = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly rolesLabel = computed(() => this.currentUser()?.roles.join(', ') ?? '');

  protected readonly form = {
    nome: '',
    email: '',
    telefone: '',
    cep: '',
    logradouro: '',
    bairro: '',
    cidade: '',
    estado: '',
    numero: '',
    complemento: '',
  };

  constructor() {
    const user = this.currentUser();
    if (user) {
      this.form.nome = user.nome;
      this.form.email = user.email;
      this.form.telefone = user.telefone;
    }
  }

  protected salvar(): void {
    this.isLoading.set(true);
    this.feedback.set(null);
    this.error.set(null);

    this.usuariosService.atualizarMeuUsuario(this.form).subscribe({
      next: (usuario) => {
        const current = this.currentUser();
        if (current) {
          this.store.dispatch(
            new UpdateAuthenticatedUser({
              ...current,
              nome: usuario.nome,
              email: usuario.email,
              telefone: usuario.telefone,
              endereco: usuario.endereco,
              role: usuario.role,
              roles: usuario.roles,
            }),
          );
        }
        this.feedback.set('Dados atualizados com sucesso.');
        this.isLoading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.isLoading.set(false);
      },
    });
  }
}
