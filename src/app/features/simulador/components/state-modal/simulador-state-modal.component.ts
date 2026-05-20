import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { SimuladorStateSnapshot, SimuladorStateStoreService } from '../../services/simulador-state-store.service';

@Component({
  selector: 'app-simulador-state-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TuiButton, TuiIcon],
  template: `
    @if (open) {
      <div class="state-backdrop" role="presentation" (click)="fechar()">
        <section class="state-modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">

          <header class="state-head">
            <div>
              <span class="state-eyebrow">Simulador — {{ operacao === 'tampao' ? 'Tampão' : 'Squeeze' }}</span>
              <h2>Cenários salvos</h2>
            </div>
            <button tuiButton type="button" size="s" appearance="secondary" (click)="fechar()">
              <tui-icon icon="@tui.x"></tui-icon>
              Fechar
            </button>
          </header>

          <!-- Salvar novo -->
          <div class="state-save-row">
            <input
              class="state-name-input"
              type="text"
              [(ngModel)]="novoNome"
              placeholder="Nome do cenário (ex: Poço 1 — 15,8 ppg)"
              (keydown.enter)="salvar()"
            />
            <button tuiButton type="button" size="m" appearance="primary" (click)="salvar()" [disabled]="!novoNome.trim()">
              <tui-icon icon="@tui.save"></tui-icon>
              Salvar estado atual
            </button>
          </div>

          <!-- Lista -->
          <div class="state-list">
            @if (snapshots.length === 0) {
              <p class="state-empty">Nenhum cenário salvo ainda.</p>
            }
            @for (snap of snapshots; track snap.id) {
              <div class="state-item" [class.state-item--selected]="selectedId === snap.id" (click)="selectedId = snap.id">
                <div class="state-item-info">
                  <strong>{{ snap.name }}</strong>
                  <span>{{ formatDate(snap.savedAt) }}</span>
                </div>
                <div class="state-item-actions">
                  <button tuiButton type="button" size="xs" appearance="primary" (click)="carregar(snap); $event.stopPropagation()">
                    <tui-icon icon="@tui.upload"></tui-icon>
                    Carregar
                  </button>
                  <button class="state-btn-update" type="button" title="Atualizar cenário com variáveis atuais" (click)="atualizar(snap.id); $event.stopPropagation()">
                    ↺
                  </button>
                  <button class="state-btn-delete" type="button" title="Deletar cenário" (click)="deletar(snap.id); $event.stopPropagation()">
                    🗑
                  </button>
                </div>
              </div>
            }
          </div>

        </section>
      </div>
    }
  `,
  styles: [`
    .state-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .state-modal {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.18);
      width: min(560px, 94vw);
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .state-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 24px 24px 16px;
      border-bottom: 1px solid #e2e8f0;
    }

    .state-eyebrow {
      display: block;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      margin-bottom: 2px;
    }

    .state-head h2 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: #1e293b;
    }

    .state-save-row {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #f1f5f9;
    }

    .state-name-input {
      flex: 1;
      padding: 9px 13px;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      font: inherit;
      font-size: 0.87rem;
      outline: none;
      transition: border-color 0.15s;
    }

    .state-name-input:focus {
      border-color: #3b82f6;
    }

    .state-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .state-empty {
      color: #94a3b8;
      font-size: 0.88rem;
      text-align: center;
      padding: 32px 0;
      margin: 0;
    }

    .state-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }

    .state-item:hover {
      border-color: #93c5fd;
      background: #f0f7ff;
    }

    .state-item--selected {
      border-color: #3b82f6;
      background: #eff6ff;
    }

    .state-item-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .state-item-info strong {
      font-size: 0.9rem;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .state-item-info span {
      font-size: 0.75rem;
      color: #64748b;
    }

    .state-item-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
      align-items: center;
    }

    .state-btn-update {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 1.5px solid #93c5fd;
      border-radius: 8px;
      background: #f0f9ff;
      color: #2563eb;
      font-size: 1.1rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      flex-shrink: 0;
    }

    .state-btn-update:hover {
      background: #dbeafe;
      border-color: #3b82f6;
    }

    .state-btn-delete {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 1.5px solid #fca5a5;
      border-radius: 8px;
      background: #fff5f5;
      color: #dc2626;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      flex-shrink: 0;
    }

    .state-btn-delete:hover {
      background: #fee2e2;
      border-color: #ef4444;
    }
  `],
})
export class SimuladorStateModalComponent implements OnChanges {
  @Input() open = false;
  @Input() operacao: 'tampao' | 'squeeze' = 'tampao';
  @Output() closed = new EventEmitter<void>();
  @Output() carregar$ = new EventEmitter<Record<string, unknown>>();

  snapshots: SimuladorStateSnapshot[] = [];
  novoNome = '';
  selectedId: string | null = null;

  private pendingFormValue: Record<string, unknown> = {};

  constructor(private store: SimuladorStateStoreService) {}

  ngOnChanges(): void {
    if (this.open) {
      this.snapshots = this.store.list(this.operacao);
      this.novoNome = '';
      this.selectedId = null;
    }
  }

  setCurrentForm(value: Record<string, unknown>): void {
    this.pendingFormValue = value;
  }

  salvar(): void {
    if (!this.novoNome.trim()) return;
    this.store.save(this.operacao, this.novoNome, this.pendingFormValue);
    this.snapshots = this.store.list(this.operacao);
    this.novoNome = '';
  }

  carregar(snap: SimuladorStateSnapshot): void {
    this.carregar$.emit(snap.formValue);
    this.fechar();
  }

  atualizar(id: string): void {
    this.store.update(this.operacao, id, this.pendingFormValue);
    this.snapshots = this.store.list(this.operacao);
  }

  deletar(id: string): void {
    this.store.delete(this.operacao, id);
    this.snapshots = this.store.list(this.operacao);
    if (this.selectedId === id) this.selectedId = null;
  }

  fechar(): void {
    this.closed.emit();
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  }
}
