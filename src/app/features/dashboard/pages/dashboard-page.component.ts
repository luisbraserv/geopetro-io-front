import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TuiIcon } from '@taiga-ui/core';
import { Store } from '@ngxs/store';

import { AuthState } from '../../../features/auth/state/auth.state';
import { QuimicoResumo, UnidadeQuimico } from '../../quimicos/models/quimico.model';
import { QuimicosStoreService } from '../../quimicos/services/quimicos-store.service';
import { Processo } from '../../gerenciamento/models/processo.model';
import { ProcessoService } from '../../gerenciamento/services/processo.service';

const NUMBER_FORMATTER = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
});

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, RouterLink, TuiIcon],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
})
export class DashboardPageComponent {
  private readonly store = inject(Store);
  private readonly quimicosStore = inject(QuimicosStoreService);
  private readonly processoService = inject(ProcessoService);

  protected readonly currentUser = this.store.selectSignal(AuthState.currentUser);
  protected readonly processos = signal<Processo[]>([]);
  protected readonly quimicosPertoVencimento = computed(() =>
    this.quimicosStore.quimicosPertoVencimento().slice(0, 5),
  );
  protected readonly quimicosEstoqueBaixo = computed(() =>
    this.quimicosStore.quimicosEstoqueBaixo().slice(0, 5),
  );
  protected readonly processosTerminamHoje = computed(() =>
    this.processos().filter((processo) => this.prazoStatus(processo) === 'today'),
  );
  protected readonly processosAtrasados = computed(() =>
    this.processos().filter((processo) => this.prazoStatus(processo) === 'late'),
  );

  constructor() {
    this.carregarProcessos();
  }

  protected formatarQuantidade(value: number, unidade: UnidadeQuimico): string {
    return `${NUMBER_FORMATTER.format(value)} ${unidade}`;
  }

  protected validadeLabel(quimico: QuimicoResumo): string {
    if (quimico.diasParaVencer === null) {
      return 'Sem validade';
    }

    if (quimico.diasParaVencer < 0) {
      return 'Vencido';
    }

    if (quimico.diasParaVencer === 0) {
      return 'Vence hoje';
    }

    return `${quimico.diasParaVencer} dias`;
  }

  private carregarProcessos(): void {
    const user = this.currentUser();
    this.processoService.listar({}).subscribe({
      next: (processos) => this.processos.set(processos),
    });
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
}
