import { Injectable } from '@angular/core';

export interface SimuladorStateSnapshot {
  id: string;
  name: string;
  operacao: 'tampao' | 'squeeze';
  savedAt: string;
  formValue: Record<string, unknown>;
}

const KEY_PREFIX = 'geopetro-state-v1-';

@Injectable({ providedIn: 'root' })
export class SimuladorStateStoreService {

  list(operacao: 'tampao' | 'squeeze'): SimuladorStateSnapshot[] {
    const key = KEY_PREFIX + operacao;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  save(operacao: 'tampao' | 'squeeze', name: string, formValue: Record<string, unknown>): SimuladorStateSnapshot {
    const snapshots = this.list(operacao);
    const snapshot: SimuladorStateSnapshot = {
      id: Date.now().toString(),
      name: name.trim() || `Cenário ${snapshots.length + 1}`,
      operacao,
      savedAt: new Date().toISOString(),
      formValue,
    };
    snapshots.unshift(snapshot);
    this.persist(operacao, snapshots);
    return snapshot;
  }

  update(operacao: 'tampao' | 'squeeze', id: string, formValue: Record<string, unknown>): void {
    const snapshots = this.list(operacao).map(s =>
      s.id === id ? { ...s, formValue, savedAt: new Date().toISOString() } : s,
    );
    this.persist(operacao, snapshots);
  }

  delete(operacao: 'tampao' | 'squeeze', id: string): void {
    const snapshots = this.list(operacao).filter(s => s.id !== id);
    this.persist(operacao, snapshots);
  }

  private persist(operacao: 'tampao' | 'squeeze', snapshots: SimuladorStateSnapshot[]): void {
    try {
      localStorage.setItem(KEY_PREFIX + operacao, JSON.stringify(snapshots));
    } catch { /* quota exceeded */ }
  }
}
