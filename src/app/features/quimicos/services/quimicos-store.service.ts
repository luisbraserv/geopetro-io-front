import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import {
  MovimentacaoQuimico,
  OperacaoSonda,
  Quimico,
  QuimicoPrevisao,
  QuimicoResumo,
  Regional,
  StatusQuimico,
  TipoMovimentacao,
  TipoQuimico,
  TipoTrabalho,
  UnidadeQuimico,
} from '../models/quimico.model';
import { environment } from '../../../../environments/environment';

const DIAS_ALERTA_VALIDADE = 60;
const FATOR_ALERTA_ESTOQUE_MINIMO = 1.2;

export function isCimentoTipo(tipo: TipoQuimico): boolean {
  return tipo === 'Cimento' || tipo === 'Cimento + Silica';
}

// ── Mapeamento entre IDs numéricos da API e strings usadas internamente ──
function toApiQuimico(input: Omit<Quimico, 'id' | 'criadoEm' | 'atualizadoEm'>) {
  return {
    nome: input.nome,
    fornecedor: input.fornecedor,
    regional: input.regional,
    lote: input.lote,
    tipo: input.tipo,
    unidade: input.unidade,
    quantidadeInicial: input.quantidadeInicial,
    estoqueMinimo: input.estoqueMinimo,
    erroPercentual: input.erroPercentual,
    dataRecebimento: input.dataRecebimento || null,
    dataValidade: input.dataValidade || null,
    status: input.status,
    observacao: input.observacao,
  };
}

function fromApiQuimico(raw: Record<string, unknown>): Quimico {
  return {
    id: String(raw['id']),
    nome: String(raw['nome'] ?? ''),
    fornecedor: String(raw['fornecedor'] ?? ''),
    regional: (raw['regional'] as Regional) ?? 'AL',
    lote: String(raw['lote'] ?? ''),
    tipo: (raw['tipo'] as TipoQuimico) ?? 'Outro',
    unidade: (raw['unidade'] as UnidadeQuimico) ?? 'kg',
    quantidadeInicial: Number(raw['quantidadeInicial'] ?? 0),
    estoqueMinimo: Number(raw['estoqueMinimo'] ?? 0),
    erroPercentual: Number(raw['erroPercentual'] ?? 0),
    dataRecebimento: String(raw['dataRecebimento'] ?? ''),
    dataValidade: String(raw['dataValidade'] ?? ''),
    status: (raw['status'] as StatusQuimico) ?? 'EM_ESTOQUE',
    observacao: String(raw['observacao'] ?? ''),
    criadoEm: String(raw['criadoEm'] ?? ''),
    atualizadoEm: String(raw['atualizadoEm'] ?? ''),
  };
}

function fromApiOperacao(raw: Record<string, unknown>): OperacaoSonda {
  return {
    id: String(raw['id']),
    sonda: String(raw['sonda'] ?? ''),
    poco: String(raw['poco'] ?? ''),
    data: String(raw['data'] ?? ''),
    tipoTrabalho: (raw['tipoTrabalho'] as TipoTrabalho) ?? 'Outro',
    criadoEm: String(raw['criadoEm'] ?? ''),
    atualizadoEm: String(raw['atualizadoEm'] ?? ''),
  };
}

function fromApiMovimentacao(raw: Record<string, unknown>): MovimentacaoQuimico {
  return {
    id: String(raw['id']),
    quimicoId: String(raw['quimicoId']),
    operacaoId: String(raw['operacaoId']),
    tipo: (raw['tipo'] as TipoMovimentacao) ?? 'uso',
    quantidade: Number(raw['quantidade'] ?? 0),
    data: String(raw['data'] ?? ''),
    poco: String(raw['poco'] ?? ''),
    tipoTrabalho: (raw['tipoTrabalho'] as TipoTrabalho) ?? 'Outro',
    profundidade: raw['profundidade'] != null ? Number(raw['profundidade']) : null,
    contrato: String(raw['contrato'] ?? ''),
    localidade: String(raw['localidade'] ?? ''),
    observacao: String(raw['observacao'] ?? ''),
    criadoEm: String(raw['criadoEm'] ?? ''),
  };
}

function daysUntil(date: string): number | null {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function signedQuantity(mov: MovimentacaoQuimico): number {
  if (mov.tipo === 'entrada') return Math.abs(mov.quantidade);
  if (mov.tipo === 'uso' || mov.tipo === 'perda') return -Math.abs(mov.quantidade);
  return mov.quantidade;
}

@Injectable({ providedIn: 'root' })
export class QuimicosStoreService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  private readonly _quimicos = signal<Quimico[]>([]);
  private readonly _operacoes = signal<OperacaoSonda[]>([]);
  private readonly _movimentacoes = signal<MovimentacaoQuimico[]>([]);
  private readonly _carregando = signal(false);

  readonly quimicos = this._quimicos.asReadonly();
  readonly operacoes = this._operacoes.asReadonly();
  readonly movimentacoes = this._movimentacoes.asReadonly();
  readonly carregando = this._carregando.asReadonly();

  readonly resumos = computed<QuimicoResumo[]>(() =>
    this._quimicos().map((q) => this.criarResumo(q)),
  );

  readonly previsoes = computed<QuimicoPrevisao[]>(() =>
    this.resumos().map((q) => this.criarPrevisao(q)),
  );

  readonly quimicosPertoVencimento = computed(() =>
    this.resumos()
      .filter((q) => this.estaAtivo(q) && this.estaPertoVencimento(q))
      .sort((a, b) => (a.diasParaVencer ?? 999) - (b.diasParaVencer ?? 999)),
  );

  readonly quimicosEstoqueBaixo = computed(() =>
    this.resumos()
      .filter((q) => this.estaAtivo(q) && this.estaPertoEstoqueMinimo(q))
      .sort((a, b) => this.percentualSobreMinimo(a) - this.percentualSobreMinimo(b)),
  );

  constructor() {
    void this.carregarTudo();
  }

  async carregarTudo(): Promise<void> {
    this._carregando.set(true);
    try {
      const [quimicos, operacoes, movimentacoes] = await Promise.all([
        firstValueFrom(this.http.get<Record<string, unknown>[]>(`${this.base}/api/quimicos`)),
        firstValueFrom(this.http.get<Record<string, unknown>[]>(`${this.base}/api/operacoes-sonda`)),
        firstValueFrom(this.http.get<Record<string, unknown>[]>(`${this.base}/api/movimentacoes-quimico`)),
      ]);
      this._quimicos.set(quimicos.map(fromApiQuimico));
      this._operacoes.set(operacoes.map(fromApiOperacao));
      this._movimentacoes.set(movimentacoes.map(fromApiMovimentacao));
    } finally {
      this._carregando.set(false);
    }
  }

  async adicionarQuimico(input: Omit<Quimico, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<void> {
    const criado = await firstValueFrom(
      this.http.post<Record<string, unknown>>(`${this.base}/api/quimicos`, toApiQuimico(input)),
    );
    this._quimicos.update((lista) => [fromApiQuimico(criado), ...lista]);
  }

  async atualizarQuimico(id: string, input: Omit<Quimico, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<void> {
    const atualizado = await firstValueFrom(
      this.http.put<Record<string, unknown>>(`${this.base}/api/quimicos/${id}`, toApiQuimico(input)),
    );
    this._quimicos.update((lista) =>
      lista.map((q) => (q.id === id ? fromApiQuimico(atualizado) : q)),
    );
  }

  async removerQuimico(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/api/quimicos/${id}`));
    this._quimicos.update((lista) => lista.filter((q) => q.id !== id));
    this._movimentacoes.update((lista) => lista.filter((m) => m.quimicoId !== id));
  }

  async adicionarOperacao(input: Omit<OperacaoSonda, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<void> {
    const criada = await firstValueFrom(
      this.http.post<Record<string, unknown>>(`${this.base}/api/operacoes-sonda`, {
        sonda: input.sonda,
        poco: input.poco,
        data: input.data,
        tipoTrabalho: input.tipoTrabalho,
      }),
    );
    this._operacoes.update((lista) => [fromApiOperacao(criada), ...lista]);
  }

  async removerOperacao(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/api/operacoes-sonda/${id}`));
    this._operacoes.update((lista) => lista.filter((o) => o.id !== id));
  }

  async adicionarMovimentacao(input: Omit<MovimentacaoQuimico, 'id' | 'criadoEm'>): Promise<void> {
    const criada = await firstValueFrom(
      this.http.post<Record<string, unknown>>(`${this.base}/api/movimentacoes-quimico`, {
        quimicoId: Number(input.quimicoId),
        operacaoId: Number(input.operacaoId),
        tipo: input.tipo,
        quantidade: input.quantidade,
        data: input.data,
        poco: input.poco,
        tipoTrabalho: input.tipoTrabalho,
        profundidade: input.profundidade,
        contrato: input.contrato,
        localidade: input.localidade,
        observacao: input.observacao,
      }),
    );
    this._movimentacoes.update((lista) => [fromApiMovimentacao(criada), ...lista]);
  }

  async removerMovimentacao(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/api/movimentacoes-quimico/${id}`));
    this._movimentacoes.update((lista) => lista.filter((m) => m.id !== id));
  }

  estoqueAtual(quimicoId: string): number {
    const quimico = this._quimicos().find((q) => q.id === quimicoId);
    const saldo = this._movimentacoes()
      .filter((m) => m.quimicoId === quimicoId)
      .reduce((total, m) => total + signedQuantity(m), 0);
    return (quimico?.quantidadeInicial ?? 0) + saldo;
  }

  // mantido para compatibilidade — não usa mais JSON local
  snapshot() { return { quimicos: this._quimicos(), operacoes: this._operacoes(), movimentacoes: this._movimentacoes() }; }
  importarDatabase(_raw: unknown): void { void this.carregarTudo(); }
  async resetarParaJsonBase(): Promise<void> { await this.carregarTudo(); }

  private criarResumo(quimico: Quimico): QuimicoResumo {
    const movs = this._movimentacoes().filter((m) => m.quimicoId === quimico.id);
    const quantidadeUtilizada = movs
      .filter((m) => m.tipo === 'uso' || m.tipo === 'perda')
      .reduce((t, m) => t + Math.abs(m.quantidade), 0);
    const quantidadeEntrada = movs
      .filter((m) => m.tipo === 'entrada')
      .reduce((t, m) => t + Math.abs(m.quantidade), 0);
    const estoqueAtual = this.estoqueAtual(quimico.id);
    const estoqueOperacional = estoqueAtual - quantidadeUtilizada * (quimico.erroPercentual / 100);
    const diasParaVencer = daysUntil(quimico.dataValidade);
    const base = { ...quimico, estoqueAtual, quantidadeUtilizada, quantidadeEntrada, estoqueOperacional, diasParaVencer };
    const alerta: 'ok' | 'atencao' | 'critico' =
      quimico.status === 'FINALIZADO' || estoqueAtual <= 0 || estoqueAtual <= quimico.estoqueMinimo
        ? 'critico'
        : this.estaPertoVencimento(base) || this.estaPertoEstoqueMinimo(base)
          ? 'atencao'
          : 'ok';
    return { ...base, alerta };
  }

  private criarPrevisao(quimico: QuimicoResumo): QuimicoPrevisao {
    const usos = this._movimentacoes().filter((m) => m.quimicoId === quimico.id && m.tipo === 'uso');
    const mediaUsoPorOperacao = usos.length
      ? usos.reduce((t, m) => t + Math.abs(m.quantidade), 0) / usos.length
      : 0;
    const consumoComErro = mediaUsoPorOperacao * (1 + quimico.erroPercentual / 100);
    const operacoesEstimadas = consumoComErro > 0 ? quimico.estoqueAtual / consumoComErro : null;
    const limite30 = new Date();
    limite30.setDate(limite30.getDate() - 30);
    const consumoUltimos30Dias = usos
      .filter((m) => new Date(`${m.data}T00:00:00`) >= limite30)
      .reduce((t, m) => t + Math.abs(m.quantidade), 0);
    const status: QuimicoPrevisao['status'] =
      usos.length === 0
        ? 'sem_historico'
        : quimico.alerta === 'critico' || (operacoesEstimadas !== null && operacoesEstimadas < 1)
          ? 'critico'
          : operacoesEstimadas !== null && operacoesEstimadas < 3
            ? 'atencao'
            : 'ok';
    return { quimico, mediaUsoPorOperacao, consumoComErro, operacoesEstimadas, consumoUltimos30Dias, status };
  }

  private estaPertoVencimento(q: Pick<QuimicoResumo, 'diasParaVencer'>): boolean {
    return q.diasParaVencer !== null && q.diasParaVencer >= 0 && q.diasParaVencer <= DIAS_ALERTA_VALIDADE;
  }

  private estaPertoEstoqueMinimo(q: Pick<QuimicoResumo, 'estoqueAtual' | 'estoqueMinimo'>): boolean {
    if (q.estoqueMinimo <= 0) return false;
    return q.estoqueAtual <= q.estoqueMinimo * FATOR_ALERTA_ESTOQUE_MINIMO;
  }

  private percentualSobreMinimo(q: Pick<QuimicoResumo, 'estoqueAtual' | 'estoqueMinimo'>): number {
    return q.estoqueMinimo > 0 ? q.estoqueAtual / q.estoqueMinimo : Number.POSITIVE_INFINITY;
  }

  private estaAtivo(q: Pick<QuimicoResumo, 'status'>): boolean {
    return q.status === 'EM_ESTOQUE' || q.status === 'CRITICO';
  }
}
