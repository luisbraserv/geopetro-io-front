import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TuiIcon } from '@taiga-ui/core';
import { Store } from '@ngxs/store';

import { AuthState } from '../../../features/auth/state/auth.state';
import { QuimicoResumo, UnidadeQuimico } from '../../quimicos/models/quimico.model';
import { QuimicosStoreService } from '../../quimicos/services/quimicos-store.service';

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

  protected readonly currentUser = this.store.selectSignal(AuthState.currentUser);
  protected readonly quimicosPertoVencimento = computed(() =>
    this.quimicosStore.quimicosPertoVencimento().slice(0, 5),
  );
  protected readonly quimicosEstoqueBaixo = computed(() =>
    this.quimicosStore.quimicosEstoqueBaixo().slice(0, 5),
  );

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
}
