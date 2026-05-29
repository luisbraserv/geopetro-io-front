export interface ConfiguracaoEmail {
  ativo: boolean;
  host: string;
  porta: number;
  starttls: boolean;
  remetente: string;
  username: string;
  senhaConfigurada: boolean;
  destinatarios: string;
  diasVencimento: number;
  intervaloReenvioDias: number;
}

export interface ConfiguracaoEmailPayload {
  ativo: boolean;
  host: string;
  porta: number;
  starttls: boolean;
  remetente: string;
  username: string;
  senha?: string;
  destinatarios: string;
  diasVencimento: number;
  intervaloReenvioDias: number;
}
