import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiIcon } from '@taiga-ui/core';

import { ToastService } from '../../../../shared/toast/toast.service';
import {
  MovimentacaoQuimico,
  OperacaoSonda,
  Quimico,
  QuimicoPrevisao,
  QuimicoResumo,
  Regional,
  StatusQuimico,
  TipoMovimentacao,
  TipoQuimico,
  TipoTrabalho,
  UnidadeQuimico,
} from '../../models/quimico.model';
import {
  isCimentoTipo,
  QuimicosStoreService,
} from '../../services/quimicos-store.service';

type QuimicoForm = Omit<Quimico, 'id' | 'criadoEm' | 'atualizadoEm'>;
type MovimentacaoForm = Omit<MovimentacaoQuimico, 'id' | 'criadoEm'>;
type OperacaoForm = Omit<OperacaoSonda, 'id' | 'criadoEm' | 'atualizadoEm'>;
type AbaQuimicos = 'cadastro' | 'operacoes' | 'movimentacao' | 'graficos';

interface ChartBar {
  label: string;
  value: number;
  detail: string;
  percentual: number;
}

interface MovimentacaoView extends MovimentacaoQuimico {
  quimicoNome: string;
  operacaoLabel: string;
  sonda: string;
  unidade: UnidadeQuimico;
}

interface OperacaoDetalhe {
  operacao: OperacaoSonda;
  movimentacoes: MovimentacaoView[];
  quantidadeQuimicos: number;
  quantidadeMovimentacoes: number;
}

interface EstoqueRegionalCard {
  regional: Regional;
  itens: number;
  alertas: number;
  quimicos: QuimicoResumo[];
}

const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  timeZone: 'UTC',
});
const NUMBER_FORMATTER = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
});

@Component({
  selector: 'app-quimicos-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TuiIcon],
  templateUrl: './quimicos-page.component.html',
  styleUrl: './quimicos-page.component.css',
})
export class QuimicosPageComponent {
  private readonly store = inject(QuimicosStoreService);
  private readonly toast = inject(ToastService);

  protected readonly abas: Array<{ id: AbaQuimicos; label: string; icon: string }> = [
    { id: 'cadastro', label: 'Cadastro', icon: '@tui.flask-conical' },
    { id: 'operacoes', label: 'Operações', icon: '@tui.clipboard-list' },
    { id: 'movimentacao', label: 'Movimentação', icon: '@tui.activity' },
    { id: 'graficos', label: 'Análise de Tendência', icon: '@tui.trending-up' },
  ];
  protected readonly regionais: Regional[] = ['AL', 'SE', 'RN', 'BA', 'ES', 'AM', 'OUTRA'];
  protected readonly tiposQuimico: TipoQuimico[] = [
    'Acelerador',
    'Anti Espumante',
    'Controlador',
    'Dispersante',
    'Estabilizador',
    'Extensor',
    'Retardante',
    'Cimento',
    'Cimento + Silica',
    'Outro',
  ];
  protected readonly unidades: UnidadeQuimico[] = ['kg', 'L', 'saco', 'un'];
  protected readonly statusOptions: StatusQuimico[] = ['EM_ESTOQUE', 'CRITICO', 'FINALIZADO'];
  protected readonly tiposMovimentacao: TipoMovimentacao[] = ['entrada', 'uso', 'perda', 'ajuste'];
  protected readonly tiposTrabalho: TipoTrabalho[] = [
    'Squeeze',
    'Tampao',
    'Teste de Injetividade',
    'Cimentacao Primaria',
    'Outro',
  ];

  protected readonly abaAtiva = signal<AbaQuimicos>('cadastro');
  protected readonly filtroBusca = signal('');
  protected readonly filtroRegional = signal('Todas');
  protected readonly filtroTipo = signal('Todos');
  protected readonly filtroStatus = signal('Todos');
  protected readonly quimicoEditandoId = signal<string | null>(null);
  protected readonly operacaoSelecionadaId = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected quimicoForm: QuimicoForm = this.criarQuimicoForm();
  protected operacaoForm: OperacaoForm = this.criarOperacaoForm();
  protected movimentacaoForm: MovimentacaoForm = this.criarMovimentacaoForm();

  protected readonly quimicos = this.store.resumos;
  protected readonly operacoes = this.store.operacoes;
  protected readonly quimicosPertoVencimento = this.store.quimicosPertoVencimento;
  protected readonly quimicosEstoqueBaixo = this.store.quimicosEstoqueBaixo;
  protected readonly cimentos = computed(() =>
    this.quimicos().filter((quimico) => this.isCimento(quimico)),
  );
  protected readonly outrosQuimicos = computed(() =>
    this.quimicos().filter((quimico) => !this.isCimento(quimico)),
  );
  protected readonly quimicosEmEstoque = computed(() =>
    this.quimicos().filter((quimico) => this.estaEmEstoque(quimico)),
  );
  protected readonly movimentacoes = computed<MovimentacaoView[]>(() =>
    this.store.movimentacoes().map((movimentacao) => {
      const quimico = this.store
        .resumos()
        .find((item) => item.id === movimentacao.quimicoId);
      const operacao = this.operacoes().find((item) => item.id === movimentacao.operacaoId);

      return {
        ...movimentacao,
        quimicoNome: quimico ?this.quimicoNomeComTipo(quimico) : 'Químico removido',
        operacaoLabel: operacao
          ? this.operacaoLabel(operacao)
          : movimentacao.operacaoId || 'Operação não informada',
        sonda: operacao?.sonda ?? '',
        unidade: quimico?.unidade ?? 'un',
        tipoTrabalho: operacao?.tipoTrabalho ?? movimentacao.tipoTrabalho,
      };
    }),
  );
  protected readonly operacaoDetalhe = computed<OperacaoDetalhe | null>(() => {
    const operacaoId = this.operacaoSelecionadaId();
    const operacao = this.operacoes().find((item) => item.id === operacaoId);

    if (!operacao) {
      return null;
    }

    const movimentacoes = this.movimentacoes().filter(
      (item) => item.operacaoId === operacao.id,
    );
    const quimicoIds = new Set(movimentacoes.map((item) => item.quimicoId));

    return {
      operacao,
      movimentacoes,
      quantidadeQuimicos: quimicoIds.size,
      quantidadeMovimentacoes: movimentacoes.length,
    };
  });

  protected operacaoSelecionada(): OperacaoSonda | null {
    return this.operacoes().find((item) => item.id === this.movimentacaoForm.operacaoId) ?? null;
  }

  protected readonly quimicosFiltrados = computed(() => {
    const busca = this.filtroBusca().trim().toLowerCase();
    const regional = this.filtroRegional();
    const tipo = this.filtroTipo();
    const status = this.filtroStatus();

    return this.quimicos().filter((quimico) => {
      const texto = `${quimico.nome} ${quimico.fornecedor} ${quimico.lote} ${quimico.tipo}`.toLowerCase();
      const passaBusca = !busca || texto.includes(busca);
      const passaRegional = regional === 'Todas' || quimico.regional === regional;
      const passaTipo = tipo === 'Todos' || quimico.tipo === tipo;
      const passaStatus = status === 'Todos' || quimico.status === status;

      return passaBusca && passaRegional && passaTipo && passaStatus;
    });
  });

  protected readonly estoquePorRegional = computed<EstoqueRegionalCard[]>(() =>
    this.regionais
      .map((regional) => {
        const quimicos = this.quimicos().filter(
          (item) => item.regional === regional && item.status !== 'FINALIZADO',
        );

        return {
          regional,
          itens: quimicos.length,
          alertas: quimicos.filter((item) => item.alerta !== 'ok').length,
          quimicos: quimicos.sort((a, b) => a.nome.localeCompare(b.nome)),
        };
      })
      .filter((card) => card.itens > 0),
  );

  protected readonly resumoGeral = computed(() => {
    const quimicos = this.quimicos();
    const movimentacoes = this.store.movimentacoes();
    const previsoes = this.store.previsoes();
    const consumoCimento30Dias = previsoes
      .filter((item) => this.isCimento(item.quimico))
      .reduce((total, item) => total + item.consumoUltimos30Dias, 0);
    const consumoQuimicos30Dias = previsoes
      .filter((item) => !this.isCimento(item.quimico))
      .reduce((total, item) => total + item.consumoUltimos30Dias, 0);

    return {
      cadastrados: quimicos.length,
      cimentos: this.cimentos().length,
      outrosQuimicos: this.outrosQuimicos().length,
      criticos: quimicos.filter((item) => item.alerta !== 'ok').length,
      movimentos: movimentacoes.length,
      consumoCimento30Dias,
      consumoQuimicos30Dias,
    };
  });

  protected readonly estoqueCimento = computed(() =>
    this.criarBarras(
      this.groupBy(
        this.cimentos(),
        (item) => `${item.nome}${item.lote ?` · ${item.lote}` : ''}`,
        (item) => Math.max(0, item.estoqueAtual),
      ),
      'saldo atual',
    ),
  );

  protected readonly estoquePorTipo = computed(() =>
    this.criarBarras(
      this.groupBy(
        this.outrosQuimicos(),
        (item) => item.tipo,
        (item) => Math.max(0, item.estoqueAtual),
      ),
      'saldo atual',
    ),
  );

  protected readonly consumoCimentoPorTrabalho = computed(() =>
    this.criarBarras(
      this.groupBy(
        this.store.movimentacoes().filter(
          (item) => item.tipo === 'uso' && this.isMovimentoCimento(item),
        ),
        (item) => this.tipoTrabalhoLabel(this.tipoTrabalhoMovimentacao(item)),
        (item) => Math.abs(item.quantidade),
      ),
      'cimento utilizado',
    ),
  );

  protected readonly consumoPorTrabalho = computed(() =>
    this.criarBarras(
      this.groupBy(
        this.store.movimentacoes().filter(
          (item) => item.tipo === 'uso' && !this.isMovimentoCimento(item),
        ),
        (item) => this.tipoTrabalhoLabel(this.tipoTrabalhoMovimentacao(item)),
        (item) => Math.abs(item.quantidade),
      ),
      'químico utilizado',
    ),
  );

  protected readonly consumoMensalCimento = computed(() => this.criarConsumoMensal(true));

  protected readonly consumoMensal = computed(() => this.criarConsumoMensal(false));

  protected readonly previsoes = computed(() =>
    this.store
      .previsoes()
      .filter((previsao) => this.temEstoqueParaPrevisao(previsao))
      .sort((a, b) => this.sortPrevisao(a) - this.sortPrevisao(b)),
  );

  protected readonly previsoesCimento = computed(() =>
    this.previsoes().filter((previsao) => this.isCimento(previsao.quimico)),
  );

  protected readonly previsoesQuimicos = computed(() =>
    this.previsoes().filter((previsao) => !this.isCimento(previsao.quimico)),
  );

  protected selecionarAba(aba: AbaQuimicos): void {
    this.abaAtiva.set(aba);
  }

  protected salvarQuimico(): void {
    const draft = this.normalizarQuimicoForm();

    if (!draft.nome) {
      this.mostrarAviso('Informe o nome do químico.');
      return;
    }

    const idEditando = this.quimicoEditandoId();

    if (idEditando) {
      void this.store.atualizarQuimico(idEditando, draft).then(() => this.mostrarAviso('Cadastro atualizado.'));
    } else {
      void this.store.adicionarQuimico(draft).then(() => this.mostrarAviso('Químico cadastrado.'));
    }

    this.cancelarEdicaoQuimico();
  }

  protected editarQuimico(quimico: QuimicoResumo): void {
    this.quimicoEditandoId.set(quimico.id);
    this.quimicoForm = {
      nome: quimico.nome,
      fornecedor: quimico.fornecedor,
      regional: quimico.regional,
      lote: quimico.lote,
      tipo: quimico.tipo,
      unidade: quimico.unidade,
      quantidadeInicial: quimico.quantidadeInicial,
      estoqueMinimo: quimico.estoqueMinimo,
      erroPercentual: quimico.erroPercentual,
      dataRecebimento: quimico.dataRecebimento,
      dataValidade: quimico.dataValidade,
      status: quimico.status,
      observacao: quimico.observacao,
    };
    this.abaAtiva.set('cadastro');
  }

  protected cancelarEdicaoQuimico(): void {
    this.quimicoEditandoId.set(null);
    this.quimicoForm = this.criarQuimicoForm();
  }

  protected salvarOperacao(): void {
    const draft = {
      sonda: this.operacaoForm.sonda.trim(),
      poco: this.operacaoForm.poco.trim(),
      data: this.operacaoForm.data || this.hoje(),
      tipoTrabalho: this.operacaoForm.tipoTrabalho,
    };

    if (!draft.sonda || !draft.poco) {
      this.mostrarAviso('Informe a sonda e o poço da operação.');
      return;
    }

    void this.store.adicionarOperacao(draft).then(() => {
      this.operacaoForm = this.criarOperacaoForm();
      this.mostrarAviso('Operação cadastrada.');
    });
  }

  protected removerOperacao(operacao: OperacaoSonda): void {
    const emUso = this.store.movimentacoes().some((item) => item.operacaoId === operacao.id);

    if (emUso) {
      this.mostrarAviso('Essa operação já possui movimentação.');
      return;
    }

    void this.store.removerOperacao(operacao.id).then(() => this.mostrarAviso('Operação removida.'));
  }

  protected abrirDetalheOperacao(operacao: OperacaoSonda): void {
    this.operacaoSelecionadaId.set(operacao.id);
  }

  protected fecharDetalheOperacao(): void {
    this.operacaoSelecionadaId.set(null);
  }

  protected removerQuimico(quimico: QuimicoResumo): void {
    const confirmado = window.confirm(
      `Remover ${quimico.nome} e todas as movimentações deste lote?`,
    );

    if (!confirmado) {
      return;
    }

    void this.store.removerQuimico(quimico.id).then(() => this.mostrarAviso('Químico removido.'));
  }

  protected salvarMovimentacao(): void {
    const quimicoId = this.movimentacaoForm.quimicoId || this.quimicosEmEstoque()[0]?.id;
    const operacao = this.operacaoSelecionada();

    if (!quimicoId) {
      this.mostrarAviso('Cadastre um químico antes de lançar movimentação.');
      return;
    }

    if (!operacao) {
      this.mostrarAviso('Selecione uma operação cadastrada.');
      return;
    }

    const quantidade = Number(this.movimentacaoForm.quantidade);

    if (!Number.isFinite(quantidade) || quantidade === 0) {
      this.mostrarAviso('Informe uma quantidade válida.');
      return;
    }

    void this.store.adicionarMovimentacao({
      ...this.movimentacaoForm,
      operacaoId: operacao.id,
      quimicoId,
      quantidade:
        this.movimentacaoForm.tipo === 'ajuste' ? quantidade : Math.abs(quantidade),
      data: operacao.data,
      poco: operacao.poco,
      tipoTrabalho: operacao.tipoTrabalho,
      contrato: this.movimentacaoForm.contrato.trim(),
      localidade: this.movimentacaoForm.localidade.trim(),
      observacao: this.movimentacaoForm.observacao.trim(),
      profundidade: null,
    }).then(() => {
      this.movimentacaoForm = this.criarMovimentacaoForm(quimicoId);
      this.mostrarAviso('Movimentação registrada.');
    });
  }

  protected removerMovimentacao(movimentacao: MovimentacaoView): void {
    void this.store.removerMovimentacao(movimentacao.id).then(() => this.mostrarAviso('Movimentação removida.'));
  }

  protected exportarJson(): void {
    const blob = new Blob([JSON.stringify(this.store.snapshot(), null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.href = url;
    link.download = `geopetro-quimicos-${this.hoje()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected importarJson(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.store.importarDatabase(JSON.parse(String(reader.result)) as unknown);
        this.mostrarAviso('JSON importado com sucesso.');
      } catch {
        this.mostrarAviso('Não foi possível importar este JSON.');
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  protected async resetarJsonBase(): Promise<void> {
    await this.store.carregarTudo();
    this.mostrarAviso('Dados recarregados da API.');
  }

  protected statusLabel(status: StatusQuimico): string {
    const labels: Record<StatusQuimico, string> = {
      EM_ESTOQUE: 'Em estoque',
      CRITICO: 'Crítico',
      FINALIZADO: 'Finalizado',
    };

    return labels[status];
  }

  protected tipoMovimentacaoLabel(tipo: TipoMovimentacao): string {
    const labels: Record<TipoMovimentacao, string> = {
      entrada: 'Entrada',
      uso: 'Uso',
      perda: 'Perda',
      ajuste: 'Ajuste',
    };

    return labels[tipo];
  }

  protected tipoTrabalhoLabel(tipo: TipoTrabalho): string {
    const labels: Record<TipoTrabalho, string> = {
      Squeeze: 'Squeeze',
      Tampao: 'Tampão',
      'Teste de Injetividade': 'Teste de injetividade',
      'Cimentacao Primaria': 'Cimentação primária',
      Outro: 'Outro',
    };

    return labels[tipo];
  }

  protected tipoQuimicoLabel(tipo: TipoQuimico | string): string {
    return tipo === 'Cimento + Silica' ?'Cimento + Sílica' : tipo;
  }

  protected quimicoNomeComTipo(quimico: Pick<QuimicoResumo, 'nome' | 'tipo' | 'regional'>): string {
    return `${quimico.nome} · ${this.tipoQuimicoLabel(quimico.tipo)} · ${quimico.regional}`;
  }

  protected operacaoLabel(operacao: OperacaoSonda): string {
    return `${operacao.id} · ${operacao.sonda} · ${operacao.poco}`;
  }

  protected formatarNumero(value: number): string {
    return NUMBER_FORMATTER.format(value);
  }

  protected formatarQuantidade(value: number, unidade: UnidadeQuimico): string {
    return `${this.formatarNumero(value)} ${unidade}`;
  }

  protected formatarData(date: string): string {
    if (!date) {
      return '-';
    }

    const parsed = new Date(`${date}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ?'-' : DATE_FORMATTER.format(parsed);
  }

  protected validadeLabel(quimico: QuimicoResumo): string {
    if (quimico.diasParaVencer === null) {
      return 'Sem validade';
    }

    if (quimico.diasParaVencer < 0) {
      return 'Vencido';
    }

    if (quimico.diasParaVencer === 0) {
      return 'Vence hoje';
    }

    return `${quimico.diasParaVencer} dias`;
  }

  protected previsaoStatusLabel(previsao: QuimicoPrevisao): string {
    const labels: Record<QuimicoPrevisao['status'], string> = {
      ok: 'Estável',
      atencao: 'Atenção',
      critico: 'Crítico',
      sem_historico: 'Sem histórico',
    };

    return labels[previsao.status];
  }

  protected operacoesLabel(value: number | null): string {
    return value === null ?'-' : NUMBER_FORMATTER.format(Math.max(0, value));
  }

  protected isCimento(quimico: Pick<QuimicoResumo, 'tipo'>): boolean {
    return isCimentoTipo(quimico.tipo);
  }

  protected temEstoqueParaPrevisao(previsao: QuimicoPrevisao): boolean {
    return previsao.quimico.status !== 'FINALIZADO' && previsao.quimico.estoqueAtual > 0;
  }

  private criarQuimicoForm(): QuimicoForm {
    return {
      nome: '',
      fornecedor: '',
      regional: 'AL',
      lote: '',
      tipo: 'Controlador',
      unidade: 'L',
      quantidadeInicial: 0,
      estoqueMinimo: 0,
      erroPercentual: 5,
      dataRecebimento: this.hoje(),
      dataValidade: '',
      status: 'EM_ESTOQUE',
      observacao: '',
    };
  }

  private criarMovimentacaoForm(quimicoId = ''): MovimentacaoForm {
    return {
      operacaoId: '',
      quimicoId,
      tipo: 'uso',
      quantidade: 0,
      data: this.hoje(),
      poco: '',
      tipoTrabalho: 'Squeeze',
      profundidade: null,
      contrato: '',
      localidade: 'AL',
      observacao: '',
    };
  }

  private criarOperacaoForm(): OperacaoForm {
    return {
      sonda: '',
      poco: '',
      data: this.hoje(),
      tipoTrabalho: 'Squeeze',
    };
  }

  private normalizarQuimicoForm(): QuimicoForm {
    return {
      ...this.quimicoForm,
      nome: this.quimicoForm.nome.trim(),
      fornecedor: this.quimicoForm.fornecedor.trim(),
      lote: this.quimicoForm.lote.trim(),
      quantidadeInicial: Math.max(0, Number(this.quimicoForm.quantidadeInicial) || 0),
      estoqueMinimo: Math.max(0, Number(this.quimicoForm.estoqueMinimo) || 0),
      erroPercentual: Math.max(0, Number(this.quimicoForm.erroPercentual) || 0),
      observacao: this.quimicoForm.observacao.trim(),
    };
  }

  private criarBarras(valores: Map<string, number>, detail: string): ChartBar[] {
    const max = Math.max(1, ...Array.from(valores.values()));

    return Array.from(valores.entries())
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({
        label,
        value,
        detail,
        percentual: Math.max(4, (value / max) * 100),
      }));
  }

  private groupBy<T>(
    itens: T[],
    getKey: (item: T) => string,
    getValue: (item: T) => number,
  ): Map<string, number> {
    const grouped = new Map<string, number>();

    itens.forEach((item) => {
      const key = getKey(item);
      grouped.set(key, (grouped.get(key) ?? 0) + getValue(item));
    });

    return grouped;
  }

  private ultimosSeisMeses(): Array<{ key: string; label: string }> {
    return Array.from({ length: 6 })
      .map((_, index) => {
        const date = new Date();
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() - (5 - index));

        return {
          key: date.toISOString().slice(0, 7),
          label: MONTH_FORMATTER.format(date).replace('.', ''),
        };
      });
  }

  private criarConsumoMensal(cimento: boolean): ChartBar[] {
    const meses = this.ultimosSeisMeses();
    const usos = this.store.movimentacoes().filter(
      (item) => item.tipo === 'uso' && this.isMovimentoCimento(item) === cimento,
    );
    const valores = new Map(meses.map((mes) => [mes.key, 0]));

    usos.forEach((item) => {
      const key = item.data.slice(0, 7);
      valores.set(key, (valores.get(key) ?? 0) + Math.abs(item.quantidade));
    });

    return this.criarBarras(
      new Map(meses.map((mes) => [mes.label, valores.get(mes.key) ?? 0])),
      'consumo',
    );
  }

  private isMovimentoCimento(movimentacao: MovimentacaoQuimico): boolean {
    const quimico = this.quimicos().find((item) => item.id === movimentacao.quimicoId);
    return quimico ? this.isCimento(quimico) : false;
  }

  private estaEmEstoque(quimico: QuimicoResumo): boolean {
    return quimico.status !== 'FINALIZADO' && quimico.estoqueAtual > 0;
  }

  private tipoTrabalhoMovimentacao(movimentacao: MovimentacaoQuimico): TipoTrabalho {
    return (
      this.operacoes().find((operacao) => operacao.id === movimentacao.operacaoId)
        ?.tipoTrabalho ?? movimentacao.tipoTrabalho
    );
  }

  private sortPrevisao(previsao: QuimicoPrevisao): number {
    const weight: Record<QuimicoPrevisao['status'], number> = {
      critico: 0,
      atencao: 1,
      sem_historico: 2,
      ok: 3,
    };

    return weight[previsao.status];
  }

  private mostrarAviso(mensagem: string): void {
    this.aviso.set(mensagem);
    this.toast.info(mensagem);
    window.setTimeout(() => this.aviso.set(null), 3200);
  }

  private hoje(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
