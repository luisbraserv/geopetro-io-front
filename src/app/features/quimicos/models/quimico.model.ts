export type Regional = 'AL' | 'SE' | 'RN' | 'BA' | 'ES' | 'AM' | 'OUTRA';

export type TipoQuimico =
  | 'Acelerador'
  | 'Anti Espumante'
  | 'Controlador'
  | 'Dispersante'
  | 'Estabilizador'
  | 'Extensor'
  | 'Retardante'
  | 'Cimento'
  | 'Cimento + Silica'
  | 'Outro';

export type UnidadeQuimico = 'kg' | 'L' | 'saco' | 'un';

export type StatusQuimico = 'EM_ESTOQUE' | 'CRITICO' | 'FINALIZADO';

export type TipoMovimentacao = 'entrada' | 'uso' | 'perda' | 'ajuste';

export type TipoTrabalho =
  | 'Squeeze'
  | 'Tampao'
  | 'Teste de Injetividade'
  | 'Cimentacao Primaria'
  | 'Outro';

export interface Quimico {
  id: string;
  nome: string;
  fornecedor: string;
  regional: Regional;
  lote: string;
  tipo: TipoQuimico;
  unidade: UnidadeQuimico;
  quantidadeInicial: number;
  estoqueMinimo: number;
  erroPercentual: number;
  dataRecebimento: string;
  dataValidade: string;
  status: StatusQuimico;
  observacao: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface MovimentacaoQuimico {
  id: string;
  operacaoId: string;
  quimicoId: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  data: string;
  poco: string;
  tipoTrabalho: TipoTrabalho;
  profundidade: number | null;
  contrato: string;
  localidade: string;
  observacao: string;
  criadoEm: string;
}

export interface OperacaoSonda {
  id: string;
  sonda: string;
  poco: string;
  data: string;
  tipoTrabalho: TipoTrabalho;
  criadoEm: string;
  atualizadoEm: string;
}

export interface QuimicosDatabase {
  schemaVersion: 1;
  dataSource: string;
  atualizadoEm: string;
  quimicos: Quimico[];
  operacoes: OperacaoSonda[];
  movimentacoes: MovimentacaoQuimico[];
}

export interface QuimicoResumo extends Quimico {
  estoqueAtual: number;
  quantidadeUtilizada: number;
  quantidadeEntrada: number;
  estoqueOperacional: number;
  diasParaVencer: number | null;
  alerta: 'ok' | 'atencao' | 'critico';
}

export interface QuimicoPrevisao {
  quimico: QuimicoResumo;
  mediaUsoPorOperacao: number;
  consumoComErro: number;
  operacoesEstimadas: number | null;
  consumoUltimos30Dias: number;
  status: 'ok' | 'atencao' | 'critico' | 'sem_historico';
}
