import { computed, Injectable, signal } from '@angular/core';

import {
  MovimentacaoQuimico,
  OperacaoSonda,
  Quimico,
  QuimicoPrevisao,
  QuimicoResumo,
  QuimicosDatabase,
  Regional,
  StatusQuimico,
  TipoMovimentacao,
  TipoQuimico,
  TipoTrabalho,
  UnidadeQuimico,
} from '../models/quimico.model';

const DATA_SOURCE_ID = 'planilha-quimicos-2026-05-08-import-2026-05-13';
const STORAGE_KEY = 'geopetro-io-quimicos-catalogo-braserv-v1';
const SEED_URL = '/data/quimicos.json';
const DIAS_ALERTA_VALIDADE = 60;
const FATOR_ALERTA_ESTOQUE_MINIMO = 1.2;

const REGIONAIS: readonly Regional[] = ['AL', 'SE', 'RN', 'BA', 'ES', 'AM', 'OUTRA'];
const TIPOS_QUIMICO: readonly TipoQuimico[] = [
  'Acelerador',
  'Anti Espumante',
  'Controlador',
  'Dispersante',
  'Estabilizador',
  'Extensor',
  'Retardante',
  'Cimento',
  'Cimento + Silica',
  'Outro',
];
const UNIDADES: readonly UnidadeQuimico[] = ['kg', 'L', 'saco', 'un'];
const STATUS: readonly StatusQuimico[] = ['EM_ESTOQUE', 'CRITICO', 'FINALIZADO'];
const TIPOS_MOVIMENTACAO: readonly TipoMovimentacao[] = ['entrada', 'uso', 'perda', 'ajuste'];
const TIPOS_TRABALHO: readonly TipoTrabalho[] = [
  'Squeeze',
  'Tampao',
  'Teste de Injetividade',
  'Cimentacao Primaria',
  'Outro',
];

function nowIso(): string {
  return new Date().toISOString();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyDatabase(): QuimicosDatabase {
  return {
    schemaVersion: 1,
    dataSource: DATA_SOURCE_ID,
    atualizadoEm: nowIso(),
    quimicos: [],
    operacoes: [],
    movimentacoes: [],
  };
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ?value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ?numeric : fallback;
}

function normalizeEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ?(value as T) : fallback;
}

function normalizeQuimico(raw: unknown): Quimico {
  const item = raw as Partial<Quimico>;
  const timestamp = asString(item.criadoEm, nowIso());

  return {
    id: asString(item.id, createId('qui')),
    nome: asString(item.nome, 'Quimico sem nome'),
    fornecedor: asString(item.fornecedor),
    regional: normalizeEnum(item.regional, REGIONAIS, 'AL'),
    lote: asString(item.lote),
    tipo: normalizeEnum(item.tipo, TIPOS_QUIMICO, 'Outro'),
    unidade: normalizeEnum(item.unidade, UNIDADES, 'kg'),
    quantidadeInicial: asNumber(item.quantidadeInicial),
    estoqueMinimo: asNumber(item.estoqueMinimo),
    erroPercentual: Math.max(0, asNumber(item.erroPercentual)),
    dataRecebimento: asString(item.dataRecebimento),
    dataValidade: asString(item.dataValidade),
    status: normalizeEnum(item.status, STATUS, 'EM_ESTOQUE'),
    observacao: asString(item.observacao),
    criadoEm: timestamp,
    atualizadoEm: asString(item.atualizadoEm, timestamp),
  };
}

function normalizeMovimentacao(raw: unknown): MovimentacaoQuimico {
  const item = raw as Partial<MovimentacaoQuimico>;

  return {
    id: asString(item.id, createId('mov')),
    operacaoId: asString(item.operacaoId),
    quimicoId: asString(item.quimicoId),
    tipo: normalizeEnum(item.tipo, TIPOS_MOVIMENTACAO, 'uso'),
    quantidade: asNumber(item.quantidade),
    data: asString(item.data, todayIso()),
    poco: asString(item.poco),
    tipoTrabalho: normalizeEnum(item.tipoTrabalho, TIPOS_TRABALHO, 'Outro'),
    profundidade: item.profundidade === null ? null : asNumber(item.profundidade, 0),
    contrato: asString(item.contrato),
    localidade: asString(item.localidade),
    observacao: asString(item.observacao),
    criadoEm: asString(item.criadoEm, nowIso()),
  };
}

function normalizeOperacao(raw: unknown, tipoTrabalhoFallback: TipoTrabalho = 'Outro'): OperacaoSonda {
  const item = raw as Partial<OperacaoSonda>;
  const timestamp = asString(item.criadoEm, nowIso());

  return {
    id: asString(item.id, createId('ope')),
    sonda: asString(item.sonda),
    poco: asString(item.poco),
    data: asString(item.data, todayIso()),
    tipoTrabalho: normalizeEnum(item.tipoTrabalho, TIPOS_TRABALHO, tipoTrabalhoFallback),
    criadoEm: timestamp,
    atualizadoEm: asString(item.atualizadoEm, timestamp),
  };
}

function operacoesFromMovimentacoes(movimentacoes: MovimentacaoQuimico[]): OperacaoSonda[] {
  const grouped = new Map<string, OperacaoSonda>();

  movimentacoes.forEach((movimentacao) => {
    const id = movimentacao.operacaoId.trim();

    if (!id || grouped.has(id)) {
      return;
    }

    grouped.set(id, {
      id,
      sonda: '',
      poco: movimentacao.poco,
      data: movimentacao.data || todayIso(),
      tipoTrabalho: movimentacao.tipoTrabalho,
      criadoEm: movimentacao.criadoEm,
      atualizadoEm: movimentacao.criadoEm,
    });
  });

  return Array.from(grouped.values()).sort((a, b) => b.data.localeCompare(a.data));
}

function normalizeDatabase(raw: unknown): QuimicosDatabase {
  const input = raw as Partial<QuimicosDatabase>;
  const quimicos = Array.isArray(input.quimicos)
    ?input.quimicos.map((item) => normalizeQuimico(item))
    : [];
  const quimicoIds = new Set(quimicos.map((item) => item.id));
  const movimentacoes = Array.isArray(input.movimentacoes)
    ?input.movimentacoes
        .map((item) => normalizeMovimentacao(item))
        .filter((item) => quimicoIds.has(item.quimicoId))
    : [];
  const tipoTrabalhoPorOperacao = new Map<string, TipoTrabalho>();
  movimentacoes.forEach((movimentacao) => {
    if (movimentacao.operacaoId && !tipoTrabalhoPorOperacao.has(movimentacao.operacaoId)) {
      tipoTrabalhoPorOperacao.set(movimentacao.operacaoId, movimentacao.tipoTrabalho);
    }
  });
  const operacoesImportadas = Array.isArray(input.operacoes)
    ? input.operacoes.map((item) =>
        normalizeOperacao(
          item,
          tipoTrabalhoPorOperacao.get(asString((item as Partial<OperacaoSonda>).id)) ?? 'Outro',
        ),
      )
    : [];
  const operacoes = operacoesImportadas.length
    ? operacoesImportadas
    : operacoesFromMovimentacoes(movimentacoes);

  return {
    schemaVersion: 1,
    dataSource: asString(input.dataSource, DATA_SOURCE_ID),
    atualizadoEm: asString(input.atualizadoEm, nowIso()),
    quimicos,
    operacoes,
    movimentacoes,
  };
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function signedQuantity(movimentacao: MovimentacaoQuimico): number {
  if (movimentacao.tipo === 'entrada') {
    return Math.abs(movimentacao.quantidade);
  }

  if (movimentacao.tipo === 'uso' || movimentacao.tipo === 'perda') {
    return -Math.abs(movimentacao.quantidade);
  }

  return movimentacao.quantidade;
}

function daysUntil(date: string): number | null {
  if (!date) {
    return null;
  }

  const target = new Date(`${date}T00:00:00`);

  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export function isCimentoTipo(tipo: TipoQuimico): boolean {
  return tipo === 'Cimento' || tipo === 'Cimento + Silica';
}

@Injectable({
  providedIn: 'root',
})
export class QuimicosStoreService {
  private readonly database = signal<QuimicosDatabase>(emptyDatabase());

  readonly quimicos = computed(() => this.database().quimicos);
  readonly operacoes = computed(() => this.database().operacoes);
  readonly movimentacoes = computed(() => this.database().movimentacoes);

  readonly resumos = computed<QuimicoResumo[]>(() =>
    this.quimicos().map((quimico) => this.criarResumo(quimico)),
  );

  readonly previsoes = computed<QuimicoPrevisao[]>(() =>
    this.resumos().map((quimico) => this.criarPrevisao(quimico)),
  );

  readonly quimicosPertoVencimento = computed(() =>
    this.resumos()
      .filter((quimico) => this.estaAtivo(quimico) && this.estaPertoVencimento(quimico))
      .sort((a, b) => (a.diasParaVencer ?? 999) - (b.diasParaVencer ?? 999)),
  );

  readonly quimicosEstoqueBaixo = computed(() =>
    this.resumos()
      .filter((quimico) => this.estaAtivo(quimico) && this.estaPertoEstoqueMinimo(quimico))
      .sort((a, b) => this.percentualSobreMinimo(a) - this.percentualSobreMinimo(b)),
  );

  constructor() {
    const cached = this.readStorage();

    if (cached) {
      this.database.set(cached);
    } else {
      void this.loadSeed();
    }
  }

  snapshot(): QuimicosDatabase {
    return structuredClone(this.database());
  }

  adicionarQuimico(
    input: Omit<Quimico, 'id' | 'criadoEm' | 'atualizadoEm'>,
  ): void {
    const timestamp = nowIso();
    const quimico: Quimico = {
      ...input,
      id: createId('qui'),
      criadoEm: timestamp,
      atualizadoEm: timestamp,
    };

    this.commit({
      ...this.database(),
      quimicos: [quimico, ...this.quimicos()],
    });
  }

  atualizarQuimico(
    id: string,
    input: Omit<Quimico, 'id' | 'criadoEm' | 'atualizadoEm'>,
  ): void {
    this.commit({
      ...this.database(),
      quimicos: this.quimicos().map((quimico) =>
        quimico.id === id
          ?{
              ...quimico,
              ...input,
              atualizadoEm: nowIso(),
            }
          : quimico,
      ),
    });
  }

  removerQuimico(id: string): void {
    this.commit({
      ...this.database(),
      quimicos: this.quimicos().filter((quimico) => quimico.id !== id),
      movimentacoes: this.movimentacoes().filter((item) => item.quimicoId !== id),
    });
  }

  adicionarOperacao(
    input: Omit<OperacaoSonda, 'id' | 'criadoEm' | 'atualizadoEm'>,
  ): void {
    const timestamp = nowIso();
    const operacao: OperacaoSonda = {
      ...input,
      id: this.proximoOperacaoId(),
      criadoEm: timestamp,
      atualizadoEm: timestamp,
    };

    this.commit({
      ...this.database(),
      operacoes: [operacao, ...this.operacoes()],
    });
  }

  removerOperacao(id: string): void {
    this.commit({
      ...this.database(),
      operacoes: this.operacoes().filter((item) => item.id !== id),
    });
  }

  adicionarMovimentacao(
    input: Omit<MovimentacaoQuimico, 'id' | 'criadoEm'>,
  ): void {
    const movimentacao: MovimentacaoQuimico = {
      ...input,
      id: createId('mov'),
      criadoEm: nowIso(),
    };

    this.commit({
      ...this.database(),
      movimentacoes: [movimentacao, ...this.movimentacoes()],
    });
  }

  removerMovimentacao(id: string): void {
    this.commit({
      ...this.database(),
      movimentacoes: this.movimentacoes().filter((item) => item.id !== id),
    });
  }

  importarDatabase(raw: unknown): void {
    this.commit(normalizeDatabase(raw));
  }

  async resetarParaJsonBase(): Promise<void> {
    await this.loadSeed(true);
  }

  estoqueAtual(quimicoId: string): number {
    const quimico = this.quimicos().find((item) => item.id === quimicoId);
    const saldoMovimentacoes = this.movimentacoes()
      .filter((item) => item.quimicoId === quimicoId)
      .reduce((total, item) => total + signedQuantity(item), 0);

    return (quimico?.quantidadeInicial ?? 0) + saldoMovimentacoes;
  }

  private criarResumo(quimico: Quimico): QuimicoResumo {
    const movimentacoes = this.movimentacoes().filter(
      (item) => item.quimicoId === quimico.id,
    );
    const quantidadeUtilizada = movimentacoes
      .filter((item) => item.tipo === 'uso' || item.tipo === 'perda')
      .reduce((total, item) => total + Math.abs(item.quantidade), 0);
    const quantidadeEntrada = movimentacoes
      .filter((item) => item.tipo === 'entrada')
      .reduce((total, item) => total + Math.abs(item.quantidade), 0);
    const estoqueAtual = this.estoqueAtual(quimico.id);
    const estoqueOperacional = estoqueAtual - quantidadeUtilizada * (quimico.erroPercentual / 100);
    const diasParaVencer = daysUntil(quimico.dataValidade);
    const baseResumo = {
      ...quimico,
      estoqueAtual,
      quantidadeUtilizada,
      quantidadeEntrada,
      estoqueOperacional,
      diasParaVencer,
    };
    const alerta =
      quimico.status === 'FINALIZADO' || estoqueAtual <= 0 || estoqueAtual <= quimico.estoqueMinimo
        ?'critico'
        : this.estaPertoVencimento(baseResumo) || this.estaPertoEstoqueMinimo(baseResumo)
          ?'atencao'
          : 'ok';

    return {
      ...baseResumo,
      alerta,
    };
  }

  private criarPrevisao(quimico: QuimicoResumo): QuimicoPrevisao {
    const usos = this.movimentacoes().filter(
      (item) => item.quimicoId === quimico.id && item.tipo === 'uso',
    );
    const mediaUsoPorOperacao = usos.length
      ?usos.reduce((total, item) => total + Math.abs(item.quantidade), 0) / usos.length
      : 0;
    const consumoComErro = mediaUsoPorOperacao * (1 + quimico.erroPercentual / 100);
    const operacoesEstimadas =
      consumoComErro > 0 ?quimico.estoqueAtual / consumoComErro : null;
    const limite30Dias = new Date();
    limite30Dias.setDate(limite30Dias.getDate() - 30);
    const consumoUltimos30Dias = usos
      .filter((item) => new Date(`${item.data}T00:00:00`) >= limite30Dias)
      .reduce((total, item) => total + Math.abs(item.quantidade), 0);
    const status =
      usos.length === 0
        ?'sem_historico'
        : quimico.alerta === 'critico' || (operacoesEstimadas !== null && operacoesEstimadas < 1)
          ?'critico'
          : operacoesEstimadas !== null && operacoesEstimadas < 3
            ?'atencao'
            : 'ok';

    return {
      quimico,
      mediaUsoPorOperacao,
      consumoComErro,
      operacoesEstimadas,
      consumoUltimos30Dias,
      status,
    };
  }

  private async loadSeed(forceCommit = false): Promise<void> {
    try {
      if (typeof fetch === 'undefined') {
        return;
      }

      const response = await fetch(SEED_URL, { cache: 'no-store' });

      if (!response.ok) {
        return;
      }

      const seed = normalizeDatabase(await response.json());

      if (forceCommit || this.quimicos().length === 0) {
        this.commit(seed);
      }
    } catch {
      if (forceCommit) {
        this.commit(emptyDatabase());
      }
    }
  }

  private commit(next: QuimicosDatabase): void {
    const normalized = normalizeDatabase({
      ...next,
      atualizadoEm: nowIso(),
    });

    this.database.set(normalized);
    this.writeStorage(normalized);
  }

  private readStorage(): QuimicosDatabase | null {
    try {
      const storage = this.storage();
      const raw = storage?.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<QuimicosDatabase>;

      if (parsed.dataSource !== DATA_SOURCE_ID) {
        return null;
      }

      return normalizeDatabase(parsed);
    } catch {
      return null;
    }
  }

  private writeStorage(database: QuimicosDatabase): void {
    try {
      this.storage()?.setItem(STORAGE_KEY, JSON.stringify(database, null, 2));
    } catch {
      // Sem escrita local: a tela continua funcionando e permite exportar JSON.
    }
  }

  private storage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage;
  }

  private estaPertoVencimento(
    quimico: Pick<QuimicoResumo, 'diasParaVencer'>,
  ): boolean {
    return (
      quimico.diasParaVencer !== null &&
      quimico.diasParaVencer >= 0 &&
      quimico.diasParaVencer <= DIAS_ALERTA_VALIDADE
    );
  }

  private estaPertoEstoqueMinimo(
    quimico: Pick<QuimicoResumo, 'estoqueAtual' | 'estoqueMinimo'>,
  ): boolean {
    if (quimico.estoqueMinimo <= 0) {
      return false;
    }

    return quimico.estoqueAtual <= quimico.estoqueMinimo * FATOR_ALERTA_ESTOQUE_MINIMO;
  }

  private percentualSobreMinimo(
    quimico: Pick<QuimicoResumo, 'estoqueAtual' | 'estoqueMinimo'>,
  ): number {
    return quimico.estoqueMinimo > 0
      ?quimico.estoqueAtual / quimico.estoqueMinimo
      : Number.POSITIVE_INFINITY;
  }

  private estaAtivo(quimico: Pick<QuimicoResumo, 'status'>): boolean {
    return quimico.status === 'EM_ESTOQUE' || quimico.status === 'CRITICO';
  }

  private proximoOperacaoId(): string {
    const maiorSequencial = this.operacoes().reduce((maior, operacao) => {
      const match = /^OP-(\d+)$/.exec(operacao.id);
      const sequencial = match ?Number(match[1]) : 0;

      return Math.max(maior, sequencial);
    }, 0);

    return `OP-${String(maiorSequencial + 1).padStart(3, '0')}`;
  }
}
