import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core';
import { switchMap } from 'rxjs';

import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfiguracaoEmailPayload } from '../../models/configuracao-email.model';
import { ConfiguracoesService } from '../../services/configuracoes.service';

@Component({
  selector: 'app-configuracoes-page',
  imports: [CommonModule, FormsModule, TuiButton],
  templateUrl: './configuracoes-page.component.html',
  styleUrl: './configuracoes-page.component.css',
})
export class ConfiguracoesPageComponent implements OnInit {
  private readonly service = inject(ConfiguracoesService);
  private readonly toast = inject(ToastService);

  protected readonly carregando = signal(false);
  protected readonly salvando = signal(false);
  protected readonly testando = signal(false);
  protected readonly senhaConfigurada = signal(false);

  protected readonly form: ConfiguracaoEmailPayload = {
    ativo: false,
    host: 'smtp.office365.com',
    porta: 587,
    starttls: true,
    remetente: '',
    username: '',
    senha: '',
    destinatarios: '',
    diasVencimento: 60,
    intervaloReenvioDias: 7,
  };

  ngOnInit(): void {
    this.carregar();
  }

  protected salvar(): void {
    this.salvando.set(true);
    this.service.salvarEmail(this.payload()).subscribe({
      next: (config) => {
        this.senhaConfigurada.set(config.senhaConfigurada);
        this.form.senha = '';
        this.toast.success('Configuracao de e-mail salva.');
        this.salvando.set(false);
      },
      error: (error: Error) => {
        this.toast.error(error.message);
        this.salvando.set(false);
      },
    });
  }

  protected enviarTeste(): void {
    this.testando.set(true);
    this.service.salvarEmail(this.payload()).pipe(switchMap((config) => {
      this.senhaConfigurada.set(config.senhaConfigurada);
      this.form.senha = '';
      return this.service.enviarTeste();
    })).subscribe({
      next: () => {
        this.toast.success('E-mail de teste enviado.');
        this.testando.set(false);
      },
      error: (error: Error) => {
        this.toast.error(error.message || 'Nao foi possivel enviar o teste.');
        this.testando.set(false);
      },
    });
  }

  private carregar(): void {
    this.carregando.set(true);
    this.service.buscarEmail().subscribe({
      next: (config) => {
        Object.assign(this.form, {
          ativo: config.ativo,
          host: config.host || 'smtp.office365.com',
          porta: config.porta || 587,
          starttls: config.starttls,
          remetente: config.remetente || '',
          username: config.username || '',
          senha: '',
          destinatarios: 'CIMENTACAO',
          diasVencimento: config.diasVencimento || 60,
          intervaloReenvioDias: config.intervaloReenvioDias || 7,
        });
        this.senhaConfigurada.set(config.senhaConfigurada);
        this.carregando.set(false);
      },
      error: (error: Error) => {
        this.toast.error(error.message);
        this.carregando.set(false);
      },
    });
  }

  private payload(): ConfiguracaoEmailPayload {
    return {
      ...this.form,
      host: this.form.host.trim(),
      remetente: this.form.remetente.trim(),
      username: this.form.username.trim(),
      senha: this.form.senha?.trim() || undefined,
      destinatarios: 'CIMENTACAO',
      porta: Number(this.form.porta) || 587,
      diasVencimento: Number(this.form.diasVencimento) || 60,
      intervaloReenvioDias: Number(this.form.intervaloReenvioDias) || 7,
    };
  }
}
