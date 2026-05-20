import { User, UserRole } from '../models/user.model';

export const MOCK_USERS: User[] = [
  {
    id: '1',
    nome: 'Administrador Geopetro',
    email: 'admin@braserv.com',
    senha: 'admin123',
    role: 'ADMIN' as UserRole,
  },
  {
    id: '2',
    nome: 'Operador de Campo',
    email: 'operador@braserv.com',
    senha: 'op123',
    role: 'OPERADOR' as UserRole,
  },
  {
    id: '3',
    nome: 'Engenheiro Sênior',
    email: 'eng@braserv.com',
    senha: 'eng123',
    role: 'ENGENHARIA' as UserRole,
  },
  {
    id: '4',
    nome: 'Usuário Padrão',
    email: 'user@braserv.com',
    senha: 'user123',
    role: 'USER' as UserRole,
  },
];
