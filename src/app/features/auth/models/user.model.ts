export type UserRole = 'ADMIN' | 'USER' | 'OPERADOR' | 'ENGENHARIA' | 'CLIENTE' | 'INTERNO' | 'CIMENTACAO';

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
  cep?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  numero?: string | null;
  complemento?: string | null;
  role: UserRole;
  roles: UserRole[];
  setorId?: number | null;
  setorNome?: string | null;
  setorIds?: number[];
  setorNomes?: string[];
}
