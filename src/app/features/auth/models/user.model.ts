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
  role: UserRole;
  roles: UserRole[];
  setorId?: number | null;
  setorNome?: string | null;
  setorIds?: number[];
  setorNomes?: string[];
}
