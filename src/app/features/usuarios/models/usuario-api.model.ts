import { UserRole } from '../../auth/models/user.model';

export interface UsuarioResponse {
  username: string;
  nome: string;
  email: string;
  telefone: string;
  endereco: string | null;
  role: UserRole;
  roles: UserRole[];
  status: 'ATIVO' | 'INATIVO';
}

export interface UsuarioPaginadoResponse {
  conteudo: UsuarioResponse[];
  pagina: number;
  tamanho: number;
  totalElementos: number;
  totalPaginas: number;
  primeira: boolean;
  ultima: boolean;
}

export interface EnderecoPayload {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  numero: string;
  complemento: string;
}

export interface UsuarioContatoPayload extends EnderecoPayload {
  nome: string;
  telefone: string;
  email: string;
}

export interface CriarUsuarioClientePayload extends UsuarioContatoPayload {
  id: number;
  empresa: string;
  username: string;
  password: string;
  roles: UserRole[];
}

export interface CriarUsuarioInternoPayload extends UsuarioContatoPayload {
  matricula: number;
  setor: string;
  username: string;
  password: string;
  roles: UserRole[];
}
