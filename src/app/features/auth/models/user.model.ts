export type UserRole =
  | 'ADMIN'
  | 'USER'
  | 'OPERADOR'
  | 'ENGENHARIA'
  | 'CLIENTE'
  | 'INTERNO'
  | 'CIMENTACAO'
  | 'SONDA'
  | 'GERENCIA'
  | 'DIRETORIA'
  | 'RECURSOS_HUMANOS'
  | 'DEPARTAMENTO_PESSOAL'
  | 'TREINAMENTO'
  | 'SISTEMA_GESTAO_INTEGRADA'
  | 'TRANSPORTE'
  | 'ELETRICA'
  | 'AUTOMACAO'
  | 'INTEGRIDADE'
  | 'SAUDE'
  | 'MANUTENCAO';

export interface User {
  id: string;
  username?: string;
  nome: string;
  email: string;
  endereco?: string;
  telefone?: string;
  senha: string;
  role: UserRole;
  roles?: UserRole[];
}

export interface AuthenticatedUser {
  token: string;
  username: string;
  nome: string;
  email: string;
  endereco: string | null;
  telefone: string;
  role: UserRole;
  roles: UserRole[];
  cep?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  numero?: string | null;
  complemento?: string | null;
  regionalId?: number | null;
  regionalNome?: string | null;
}
