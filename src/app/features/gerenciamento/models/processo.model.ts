export type StatusProcesso = 'ABERTO' | 'EM_ANDAMENTO' | 'PAUSADO' | 'CONCLUIDO' | 'CANCELADO' | 'ARQUIVADO';
export type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export interface Processo {
  id: number;
  titulo: string;
  descricao?: string | null;
  statusProcesso: StatusProcesso;
  centroCusto?: string | null;
  dataInicio?: string | null;
  dataPrevisaoConclusao?: string | null;
  dataFim?: string | null;
  prioridade: Prioridade;
  setorId: number;
  setorNome: string;
  unidadeSondaId?: number | null;
  unidadeSondaNome?: string | null;
  unidadeSondaApelido?: string | null;
  projetoId?: number | null;
  projetoNome?: string | null;
  criadoPorUsername?: string | null;
  responsavelUsername?: string | null;
  responsavelNome?: string | null;
  criadoEm?: string | null;
  atualizadoEm?: string | null;
}

export interface ProcessoPayload {
  titulo: string;
  descricao?: string | null;
  statusProcesso: StatusProcesso;
  centroCusto?: string | null;
  dataInicio?: string | null;
  dataPrevisaoConclusao?: string | null;
  dataFim?: string | null;
  prioridade: Prioridade;
  setorId: number;
  unidadeSondaId: number;
  projetoId: number | null;
  responsavelUsername?: string | null;
}

export interface ProcessoFiltros {
  status?: StatusProcesso | '';
  prioridade?: Prioridade | '';
  setorId?: number | '';
  setorIds?: number[];
  unidadeSondaId?: number | '';
  projetoId?: number | '';
  responsavelUsername?: string | '';
  texto?: string;
}

export interface Anotacao {
  id: number;
  titulo: string;
  texto: string;
  dataCriacao?: string | null;
  processoId: number;
  criadoPorUsername?: string | null;
}

export interface AnotacaoPayload {
  titulo: string;
  texto: string;
}

export interface Observacao {
  id: number;
  titulo: string;
  texto: string;
  setorId: number;
  setorNome: string;
  criadoPorUsername?: string | null;
  criadoEm?: string | null;
  atualizadoEm?: string | null;
}

export interface ObservacaoPayload {
  titulo: string;
  texto: string;
  setorId: number;
}
