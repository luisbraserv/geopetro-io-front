import { HttpErrorResponse } from '@angular/common/http';

type ApiErrorBody = {
  message?: string;
  detail?: string;
  title?: string;
  error?: string;
  errors?: string[] | Record<string, string | string[]>;
};

export function parseApiError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Não foi possível concluir a operação.';
  }

  if (error.status === 0) {
    return 'Não foi possível conectar ao servidor.';
  }

  const body = error.error as ApiErrorBody | string | null;

  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  if (body && typeof body === 'object') {
    const mainMessage = body.message || body.detail || body.title || body.error;

    if (mainMessage) {
      return mainMessage;
    }

    if (Array.isArray(body.errors) && body.errors.length > 0) {
      return body.errors.join(' ');
    }

    if (body.errors && typeof body.errors === 'object') {
      return Object.values(body.errors).flat().join(' ');
    }
  }

  if (error.status === 401 || error.status === 403) {
    return 'Usuário ou senha inválidos.';
  }

  return 'Erro ao processar resposta do servidor.';
}
