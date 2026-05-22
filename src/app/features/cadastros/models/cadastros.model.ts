export interface Empresa {
  id: number;
  nome: string;
  telefone?: string | null;
  cnpj?: string | null;
  email?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  numero?: string | null;
  complemento?: string | null;
}

export type EmpresaPayload = Omit<Empresa, 'id'>;

export interface Setor {
  id: number;
  nome: string;
  centroCusto?: string | null;
  regional?: string | null;
}

export type SetorPayload = Omit<Setor, 'id'>;

export interface UnidadeSonda {
  id: number;
  nome: string;
  apelido?: string | null;
  setorId: number;
  setorNome: string;
}

export interface UnidadeSondaPayload {
  nome: string;
  apelido?: string | null;
  setorId: number;
}

export interface Projeto {
  id: number;
  nome: string;
  descricao?: string | null;
  centroCusto?: string | null;
  setorId: number;
  setorNome: string;
  criadoPorUsername?: string | null;
  responsavelUsername?: string | null;
  responsavelNome?: string | null;
  criadoEm?: string | null;
  atualizadoEm?: string | null;
}

export interface ProjetoPayload {
  nome: string;
  descricao?: string | null;
  centroCusto?: string | null;
  setorId: number;
  responsavelUsername?: string | null;
}
