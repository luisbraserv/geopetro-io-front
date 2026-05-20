import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import {
  ADITIVO_CATEGORIAS,
  ADITIVO_MISTURADO_EM,
  ADITIVO_UNIDADES_DOSAGEM,
  Aditivo,
  AditivoCatalogo,
  AditivoCategoria,
  AditivoEstadoFisico,
  MisturadoEm,
  UnidadeDosagem,
} from '../../models/aditivo.model';
import { SlurryCalculoService } from '../../services/slurry-calculo.service';
import { RheologyAdjustmentService } from '../../services/rheology-adjustment.service';

type SectionId = 'id' | 'dosage' | 'physical' | 'effects' | 'rheology' | 'compatibility';

@Component({
  selector: 'app-aditivo-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TuiButton, TuiIcon],
  template: `
    @if (open) {
      <div class="modal-backdrop" role="presentation" (click)="cancelar()">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="aditivo-title" (click)="$event.stopPropagation()">
          <header class="modal-head">
            <div>
              <span class="eyebrow">Cadastro de cimentação</span>
              <h2 id="aditivo-title">Aditivos da pasta</h2>
            </div>
            <button tuiButton type="button" size="s" appearance="secondary" (click)="cancelar()">
              <tui-icon icon="@tui.x"></tui-icon>
              Cancelar
            </button>
          </header>

          <div class="actions">
            <button tuiButton type="button" size="s" appearance="primary" (click)="novoAditivo()">
              <tui-icon icon="@tui.plus"></tui-icon>
              Novo aditivo
            </button>
            <select class="catalog" (change)="adicionarCatalogo($any($event.target).value); $any($event.target).value = ''">
              <option value="">Adicionar do catálogo</option>
              @for (cat of catalogo; track cat.catalogId) {
                <option [value]="cat.catalogId">{{ cat.name }} - {{ categoryLabel(cat.category) }}</option>
              }
            </select>
            <button tuiButton type="button" size="s" appearance="secondary" [disabled]="selectedIndex < 0" (click)="removerSelecionado()">
              <tui-icon icon="@tui.trash-2"></tui-icon>
              Remover aditivo
            </button>
            <div class="actions-sep"></div>
            <button tuiButton type="button" size="s" appearance="secondary" (click)="exportarJson()">
              <tui-icon icon="@tui.download"></tui-icon>
              Exportar JSON
            </button>
            <button tuiButton type="button" size="s" appearance="secondary" (click)="fileInput.click()">
              <tui-icon icon="@tui.upload"></tui-icon>
              Importar JSON
            </button>
            <input #fileInput type="file" accept=".json" style="display:none" (change)="onImportFile($any($event.target).files)">
            <button tuiButton type="button" size="s" appearance="primary" (click)="salvar()">
              <tui-icon icon="@tui.save"></tui-icon>
              Salvar
            </button>
          </div>

          <div class="grid">
            <aside class="list">
              <h3>Aditivos da pasta</h3>
              @if (!formArray || formArray.length === 0) {
                <div class="empty">Nenhum aditivo cadastrado.</div>
              } @else {
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Categoria</th>
                        <th>Estado</th>
                        <th>Conc.</th>
                        <th>Unidade</th>
                        <th>Reologia</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of controls(); track $index) {
                        <tr [class.active]="$index === selectedIndex" (click)="select($index)">
                          <td>{{ value(row, 'name') || 'Aditivo' }}</td>
                          <td>{{ categoryLabel(value(row, 'category')) }}</td>
                          <td>{{ stateLabel(value(row, 'type')) }}</td>
                          <td>{{ value(row, 'conc') }}</td>
                          <td>{{ unitLabel(value(row, 'unidadeDosagem')) }}</td>
                          <td>{{ value(row, 'afetaReologia') ? 'Sim' : 'Não' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </aside>

            <main class="editor">
              @if (selectedForm(); as group) {
                <nav class="tabs" aria-label="Seções do aditivo">
                  @for (section of sections; track section.id) {
                    <button type="button" [class.active]="activeSection === section.id" (click)="activeSection = section.id">{{ section.label }}</button>
                  }
                </nav>

                <form [formGroup]="group" class="form">
                  @if (activeSection === 'id') {
                    <div class="fields three">
                      <label>Nome comercial<input formControlName="name"></label>
                      <label>Nome químico<input formControlName="nomeQuimico"></label>
                      <label>Fabricante<input formControlName="fabricante"></label>
                      <label>Categoria
                        <select formControlName="category">
                          @for (c of categorias; track c.value) { <option [value]="c.value">{{ c.label }}</option> }
                        </select>
                      </label>
                      <label>Função principal<input formControlName="funcaoPrincipal"></label>
                      <label>Código interno<input formControlName="codigoInterno"></label>
                      <label class="wide">Descrição<textarea rows="3" formControlName="descricao"></textarea></label>
                      <label class="check"><input type="checkbox" formControlName="ativo"> Ativo</label>
                    </div>
                  }

                  @if (activeSection === 'dosage') {
                    <div class="fields three">
                      <label>Estado físico
                        <select formControlName="type">
                          <option value="solid">Sólido</option>
                          <option value="liquid">Líquido</option>
                          <option value="gas">Gás</option>
                        </select>
                      </label>
                      <label>Unidade
                        <select formControlName="unidadeDosagem">
                          @for (u of unidades; track u.value) { <option [value]="u.value">{{ u.label }}</option> }
                        </select>
                      </label>
                      <label>Concentração usada<input type="number" step="0.001" formControlName="conc"></label>
                      <label>Concentração padrão<input type="number" step="0.001" formControlName="concentracaoPadrao"></label>
                      <label>Concentração mín.<input type="number" step="0.001" formControlName="concentracaoMin"></label>
                      <label>Concentração máx.<input type="number" step="0.001" formControlName="concentracaoMax"></label>
                      <label>Misturado em
                        <select formControlName="misturadoEm">
                          @for (m of misturadoEm; track m.value) { <option [value]="m.value">{{ m.label }}</option> }
                        </select>
                      </label>
                      <label class="check"><input type="checkbox" formControlName="obrigatorioNaPasta"> Obrigatório na pasta</label>
                    </div>
                  }

                  @if (activeSection === 'physical') {
                    <div class="fields three">
                      <label>Massa específica<input type="number" step="0.0001" formControlName="massaEspecifica"></label>
                      <label>Unidade
                        <select formControlName="massaEspecificaUnidade">
                          <option value="sg">sg</option>
                          <option value="lbPerGal">lb/gal</option>
                          <option value="kgPerM3">kg/m³</option>
                          <option value="gPerCm3">g/cm³</option>
                        </select>
                      </label>
                      <label>Volume absoluto (gal/lb)<input type="number" step="0.0001" formControlName="volumeAbsolutoGalPerLb"></label>
                      <label>Densidade (lb/gal)<input type="number" step="0.001" formControlName="densidadeLbGal"></label>
                      <label>Pureza (%)<input type="number" step="0.1" formControlName="purezaPercent"></label>
                      <label>Solubilidade<input formControlName="solubilidade"></label>
                      <label>Temp. mín. (°F)<input type="number" step="1" formControlName="temperaturaMinF"></label>
                      <label>Temp. máx. (°F)<input type="number" step="1" formControlName="temperaturaMaxF"></label>
                    </div>
                  }

                  @if (activeSection === 'effects') {
                    <div class="fields three">
                      @for (field of effectFields; track field.key) {
                        <label>{{ field.label }}
                          <select [formControlName]="field.key">
                            @for (option of field.options; track option) { <option [value]="option">{{ option }}</option> }
                          </select>
                        </label>
                      }
                    </div>
                  }

                  @if (activeSection === 'rheology') {
                    <div class="fields three">
                      <label class="check"><input type="checkbox" formControlName="afetaReologia"> Afeta reologia</label>
                      <label>Efeito principal
                        <select formControlName="efeitoReologicoPrincipal">
                          @for (e of rheologyEffects; track e) { <option [value]="e">{{ e }}</option> }
                        </select>
                      </label>
                      <label>Modelo
                        <select formControlName="modeloReologico">
                          @for (m of rheologyModels; track m) { <option [value]="m">{{ m }}</option> }
                        </select>
                      </label>
                      <label>VP (cP)<input type="number" step="0.1" formControlName="plasticViscosityCp"></label>
                      <label>LE (lbf/100ft²)<input type="number" step="0.1" formControlName="yieldPointLbf100ft2"></label>
                      <label>Gel 10s<input type="number" step="0.1" formControlName="gel10sLbf100ft2"></label>
                      <label>Gel 10min<input type="number" step="0.1" formControlName="gel10minLbf100ft2"></label>
                      <label>Gel 30min<input type="number" step="0.1" formControlName="gel30minLbf100ft2"></label>
                      <label>Consistência (Bc)<input type="number" step="0.1" formControlName="consistencyBc"></label>
                      <label>TT (min)<input type="number" step="1" formControlName="thickeningTimeMin"></label>
                      <label>Filtrado (cc/30min)<input type="number" step="1" formControlName="fluidLossCc30min"></label>
                      <label>Água livre (ml)<input type="number" step="0.1" formControlName="freeWaterMl"></label>
                      @for (rpm of fannFields; track rpm) {
                        <label>{{ rpm.toUpperCase() }}<input type="number" step="0.1" [formControlName]="rpm"></label>
                      }
                      <label>Temp. teste (°F)<input type="number" step="1" formControlName="temperaturaTesteF"></label>
                      <label>Pressão teste (psi)<input type="number" step="1" formControlName="pressaoTestePsi"></label>
                      <label>Condicionamento (min)<input type="number" step="1" formControlName="tempoCondicionamentoMin"></label>
                      <label>Concentração teste<input type="number" step="0.001" formControlName="concentracaoTeste"></label>
                      <label>Unidade teste
                        <select formControlName="unidadeConcentracaoTeste">
                          <option value="">-</option>
                          @for (u of unidades; track u.value) { <option [value]="u.value">{{ u.label }}</option> }
                        </select>
                      </label>
                      <label>ΔVP/unid.<input type="number" step="0.001" formControlName="pvDeltaPerUnit"></label>
                      <label>ΔLE/unid.<input type="number" step="0.001" formControlName="ypDeltaPerUnit"></label>
                      <label>ΔGel10s/unid.<input type="number" step="0.001" formControlName="gel10sDeltaPerUnit"></label>
                      <label>ΔGel10min/unid.<input type="number" step="0.001" formControlName="gel10minDeltaPerUnit"></label>
                      <label>Multiplicador fricção<input type="number" step="0.001" formControlName="frictionFactorMultiplier"></label>
                      <label>ΔConsistência/unid.<input type="number" step="0.001" formControlName="consistencyDeltaPerUnit"></label>
                      <label>ΔTT min/unid.<input type="number" step="0.001" formControlName="thickeningTimeDeltaMinPerUnit"></label>
                    </div>
                  }

                  @if (activeSection === 'compatibility') {
                    <div class="checks">
                      @for (field of compatibilityFields; track field.key) {
                        <label><input type="checkbox" [formControlName]="field.key"> {{ field.label }}</label>
                      }
                    </div>
                    <div class="fields">
                      <label>Observações operacionais<textarea rows="3" formControlName="observacoesOperacionais"></textarea></label>
                      <label>Observações de laboratório<textarea rows="3" formControlName="observacoesLaboratorio"></textarea></label>
                      <label>Fonte dos dados<input formControlName="fonteDados"></label>
                    </div>
                  }

                  <div class="calc-box">
                    <strong>Cálculo por saco</strong>
                    <span>Massa: {{ additiveCalc(group).wt | number:'1.3-3' }} lb/sk</span>
                    <span>Volume: {{ additiveCalc(group).vol | number:'1.3-3' }} gal/sk</span>
                    <span>Volume absoluto: {{ additiveCalc(group).absoluteVolumeGal | number:'1.3-3' }} gal/sk</span>
                  </div>

                  @for (warning of warnings(group); track warning) {
                    <div class="warning">{{ warning }}</div>
                  }
                </form>
              } @else {
                <div class="empty editor-empty">Crie ou selecione um aditivo para editar.</div>
              }
            </main>
          </div>
        </section>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop{position:fixed;inset:0;z-index:50;background:rgba(15,23,42,.45);display:grid;place-items:center;padding:20px}
    .modal{width:min(1180px,96vw);max-height:92vh;overflow:hidden;background:#f8fafc;border:1px solid #dbe3ef;border-radius:12px;box-shadow:0 24px 70px rgba(15,23,42,.28);display:flex;flex-direction:column;color:#233044}
    .modal-head,.actions{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid #e2e8f0;background:#fff}
    .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#607086;font-weight:700}.modal h2{margin:2px 0 0;font-size:22px}.actions{justify-content:flex-start;flex-wrap:wrap}.catalog{min-height:34px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:0 10px}.actions-sep{width:1px;height:28px;background:#e2e8f0;margin:0 4px;flex-shrink:0}
    .grid{display:grid;grid-template-columns:minmax(360px,45%) 1fr;min-height:0;overflow:hidden}.list,.editor{padding:16px;overflow:auto}.list{border-right:1px solid #e2e8f0;background:#f1f5f9}.list h3{margin:0 0 10px;font-size:15px}
    .table-wrap{overflow:auto;border:1px solid #d9e2ee;border-radius:10px;background:#fff}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:9px 8px;border-bottom:1px solid #e8edf5;text-align:left;white-space:nowrap}th{background:#eef4fb;color:#475569;font-weight:700}tr{cursor:pointer}tr.active,tbody tr:hover{background:#e0f2fe}
    .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}.tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 10px;font-size:12px;color:#334155}.tabs button.active{background:#0f766e;color:#fff;border-color:#0f766e}
    .fields{display:grid;grid-template-columns:1fr;gap:10px}.fields.three{grid-template-columns:repeat(3,minmax(0,1fr))}.fields label,.checks label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:#475569}.fields input,.fields select,.fields textarea{border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:8px 9px;font:inherit;color:#1f2937}.fields textarea{resize:vertical}.wide{grid-column:1/-1}.check{align-self:end;flex-direction:row!important;align-items:center}
    .checks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 14px;margin-bottom:12px}.checks label{flex-direction:row;align-items:center;font-weight:600}.calc-box{margin-top:14px;display:flex;flex-wrap:wrap;gap:10px;padding:10px 12px;border:1px solid #cfe8e5;background:#ecfdf5;border-radius:10px;font-size:12px}.calc-box strong{width:100%;font-size:13px}.warning{margin-top:8px;padding:9px 10px;border:1px solid #facc15;background:#fefce8;border-radius:8px;color:#854d0e;font-size:12px}.empty{border:1px dashed #cbd5e1;border-radius:10px;padding:16px;text-align:center;color:#64748b;background:#fff}.editor-empty{margin-top:34px}
    @media(max-width:900px){.grid{grid-template-columns:1fr}.list{border-right:0;border-bottom:1px solid #e2e8f0}.fields.three,.checks{grid-template-columns:1fr}.modal{max-height:96vh}}
  `],
})
export class AditivoModalComponent {
  @Input() open = false;
  @Input() formArray!: FormArray;
  @Input() catalogo: AditivoCatalogo[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() exportJson = new EventEmitter<void>();
  @Output() importJson = new EventEmitter<unknown[]>();
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  selectedIndex = -1;
  activeSection: SectionId = 'id';
  readonly categorias = ADITIVO_CATEGORIAS;
  readonly unidades = ADITIVO_UNIDADES_DOSAGEM;
  readonly misturadoEm = ADITIVO_MISTURADO_EM;
  readonly sections: { id: SectionId; label: string }[] = [
    { id: 'id', label: 'Identificação' },
    { id: 'dosage', label: 'Dosagem' },
    { id: 'physical', label: 'Propriedades físicas' },
    { id: 'effects', label: 'Efeitos na pasta' },
    { id: 'rheology', label: 'Reologia' },
    { id: 'compatibility', label: 'Compatibilidade' },
  ];
  readonly rheologyModels = ['none', 'binghamPlastic', 'powerLaw', 'herschelBulkley', 'fannReadings', 'empirical'];
  readonly rheologyEffects = ['dispersant', 'viscosifier', 'thixotropic', 'frictionReducer', 'yieldPointReducer', 'yieldPointIncreaser', 'plasticViscosityReducer', 'plasticViscosityIncreaser', 'gelStrengthIncreaser', 'gelStrengthReducer', 'neutral', 'unknown'];
  readonly fannFields = ['rpm300', 'rpm200', 'rpm100', 'rpm60', 'rpm30', 'rpm6', 'rpm3'];
  readonly effectFields = [
    { key: 'alteraDensidade', label: 'Densidade', options: ['increase', 'decrease', 'neutral', 'unknown'] },
    { key: 'alteraTempoPega', label: 'Tempo de pega', options: ['accelerate', 'retard', 'neutral', 'unknown'] },
    { key: 'alteraFiltrado', label: 'Filtrado', options: ['reduce', 'increase', 'neutral', 'unknown'] },
    { key: 'alteraAguaLivre', label: 'Água livre', options: ['reduce', 'increase', 'neutral', 'unknown'] },
    { key: 'alteraResistenciaCompressao', label: 'Resistência', options: ['increase', 'decrease', 'neutral', 'unknown'] },
    { key: 'alteraEstabilidade', label: 'Estabilidade', options: ['increase', 'decrease', 'neutral', 'unknown'] },
    { key: 'alteraSedimentacao', label: 'Sedimentação', options: ['reduce', 'increase', 'neutral', 'unknown'] },
    { key: 'alteraRiscoGasMigration', label: 'Risco de gás', options: ['reduce', 'increase', 'neutral', 'unknown'] },
    { key: 'alteraPerdaCirculacao', label: 'Perda de circulação', options: ['reduce', 'neutral', 'unknown'] },
  ];
  readonly compatibilityFields = [
    { key: 'compativelComAguaDoce', label: 'Água doce' },
    { key: 'compativelComAguaMar', label: 'Água do mar' },
    { key: 'compativelComSalmoura', label: 'Salmoura' },
    { key: 'compativelComLatex', label: 'Látex' },
    { key: 'compativelComSilica', label: 'Sílica' },
    { key: 'compativelComEspumada', label: 'Pasta espumada' },
    { key: 'riscoEspuma', label: 'Risco de espuma' },
  ];

  constructor(
    private fb: FormBuilder,
    private slurryCalc: SlurryCalculoService,
    private rheology: RheologyAdjustmentService,
  ) {}

  controls(): FormGroup[] {
    return (this.formArray?.controls || []) as FormGroup[];
  }

  selectedForm(): FormGroup | null {
    return this.selectedIndex >= 0 ? this.formArray?.at(this.selectedIndex) as FormGroup : null;
  }

  select(index: number): void {
    this.selectedIndex = index;
  }

  novoAditivo(): void {
    this.formArray.push(this.createGroup({ name: 'Novo aditivo', category: 'other', type: 'solid', conc: 0, unidadeDosagem: 'percentBWOC', ativo: true }));
    this.selectedIndex = this.formArray.length - 1;
    this.activeSection = 'id';
  }

  adicionarCatalogo(catalogId: string): void {
    const cat = this.catalogo.find(item => item.catalogId === catalogId);
    if (!cat) return;
    this.formArray.push(this.createGroup(cat));
    this.selectedIndex = this.formArray.length - 1;
    this.activeSection = 'dosage';
  }

  removerSelecionado(): void {
    if (this.selectedIndex < 0) return;
    this.formArray.removeAt(this.selectedIndex);
    this.selectedIndex = Math.min(this.selectedIndex, this.formArray.length - 1);
  }

  salvar(): void {
    if (this.formArray.invalid) {
      this.formArray.markAllAsTouched();
      return;
    }
    this.closed.emit();
  }

  cancelar(): void {
    this.closed.emit();
  }

  exportarJson(): void {
    this.exportJson.emit();
  }

  onImportFile(files: FileList | null): void {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (Array.isArray(parsed)) this.importJson.emit(parsed);
      } catch { /* JSON inválido — ignora */ }
      if (this.fileInputRef) this.fileInputRef.nativeElement.value = '';
    };
    reader.readAsText(file);
  }

  additiveCalc(group: FormGroup) {
    return this.slurryCalc.getAdditiveCalcs([this.toAditivo(group)])[0] || { wt: 0, vol: 0, absoluteVolumeGal: 0 };
  }

  warnings(group: FormGroup): string[] {
    const aditivo = this.toAditivo(group);
    const out: string[] = [];
    const conc = this.num(aditivo.conc);
    if (conc < 0) out.push('Concentração não pode ser negativa.');
    if (this.num(aditivo.concentracaoMin, NaN) > conc) out.push('Concentração abaixo do mínimo cadastrado.');
    if (this.num(aditivo.concentracaoMax, NaN) < conc) out.push('Concentração acima do máximo cadastrado.');
    if (aditivo.type === 'liquid' && !this.num(aditivo.densidadeLbGal) && !this.num(aditivo.massaEspecifica)) out.push('Aditivo líquido precisa de densidade ou massa específica para cálculo preciso.');
    if (aditivo.type === 'solid' && !this.num(aditivo.volumeAbsolutoGalPerLb) && !this.num(aditivo.massaEspecifica)) out.push('Aditivo sólido precisa de volume absoluto ou massa específica para cálculo preciso.');
    if (aditivo.afetaReologia && !this.rheology.hasAutomaticRheologyData(aditivo)) out.push('Este aditivo pode afetar a reologia, mas não possui coeficientes cadastrados. A reologia não será alterada automaticamente.');
    return out;
  }

  value(row: FormGroup, control: string): any {
    return row.get(control)?.value;
  }

  categoryLabel(value: AditivoCategoria | string): string {
    return this.categorias.find(c => c.value === value)?.label || String(value || '-');
  }

  unitLabel(value: UnidadeDosagem | string): string {
    return this.unidades.find(u => u.value === value)?.label || String(value || '-');
  }

  stateLabel(value: AditivoEstadoFisico | string): string {
    return value === 'solid' ? 'Sólido' : value === 'liquid' ? 'Líquido' : value === 'gas' ? 'Gás' : '-';
  }

  createGroup(data: Partial<AditivoCatalogo & Aditivo> = {}): FormGroup {
    const coefficients = data.coefficients || data.rheology?.coefficients || {};
    const fann = data.rheology?.fannReadings || {};
    return this.fb.group({
      catalogId: [data.catalogId ?? data.id ?? ''],
      name: [data.name ?? data.nomeComercial ?? data.commercialName ?? '', Validators.required],
      nomeQuimico: [data.nomeQuimico ?? ''],
      category: [data.category ?? data.categoria ?? 'other', Validators.required],
      type: [data.type ?? data.estadoFisico ?? 'solid', Validators.required],
      conc: [data.conc ?? data.defaultConc ?? data.concentracaoPadrao ?? 0, [Validators.required, Validators.min(0)]],
      concentracaoPadrao: [data.concentracaoPadrao ?? data.defaultConc ?? data.conc ?? 0],
      concentracaoMin: [data.concentracaoMin ?? null],
      concentracaoMax: [data.concentracaoMax ?? null],
      unidadeDosagem: [data.unidadeDosagem ?? this.legacyUnit(data.unit, data.type), Validators.required],
      misturadoEm: [data.misturadoEm ?? 'aguaMistura'],
      obrigatorioNaPasta: [data.obrigatorioNaPasta ?? false],
      descricao: [data.descricao ?? data.description ?? ''],
      fabricante: [data.fabricante ?? ''],
      codigoInterno: [data.codigoInterno ?? ''],
      ativo: [data.ativo ?? true],
      funcaoPrincipal: [data.funcaoPrincipal ?? data.primaryFunction ?? ''],
      massaEspecifica: [data.massaEspecifica ?? data.specificGravity ?? null],
      massaEspecificaUnidade: [data.massaEspecificaUnidade ?? (data.specificGravity ? 'sg' : 'sg')],
      volumeAbsolutoGalPerLb: [data.volumeAbsolutoGalPerLb ?? data.absoluteVolumeGalLb ?? null],
      densidadeLbGal: [data.densidadeLbGal ?? data.densityLbGal ?? data.densityLb ?? null],
      purezaPercent: [data.purezaPercent ?? null],
      solubilidade: [data.solubilidade ?? ''],
      temperaturaMaxF: [data.temperaturaMaxF ?? null],
      temperaturaMinF: [data.temperaturaMinF ?? null],
      alteraDensidade: [data.alteraDensidade ?? 'unknown'],
      alteraTempoPega: [data.alteraTempoPega ?? 'unknown'],
      alteraFiltrado: [data.alteraFiltrado ?? 'unknown'],
      alteraAguaLivre: [data.alteraAguaLivre ?? 'unknown'],
      alteraResistenciaCompressao: [data.alteraResistenciaCompressao ?? 'unknown'],
      alteraEstabilidade: [data.alteraEstabilidade ?? 'unknown'],
      alteraSedimentacao: [data.alteraSedimentacao ?? 'unknown'],
      alteraRiscoGasMigration: [data.alteraRiscoGasMigration ?? 'unknown'],
      alteraPerdaCirculacao: [data.alteraPerdaCirculacao ?? 'unknown'],
      afetaReologia: [data.afetaReologia ?? data.rheology?.affectsRheology ?? false],
      efeitoReologicoPrincipal: [data.efeitoReologicoPrincipal ?? data.rheology?.mainEffect ?? 'unknown'],
      modeloReologico: [data.modeloReologico ?? data.rheology?.model ?? 'none'],
      plasticViscosityCp: [data.plasticViscosityCp ?? data.rheology?.plasticViscosityCp ?? null],
      yieldPointLbf100ft2: [data.yieldPointLbf100ft2 ?? data.rheology?.yieldPointLbf100ft2 ?? null],
      gel10sLbf100ft2: [data.gel10sLbf100ft2 ?? data.rheology?.gel10sLbf100ft2 ?? null],
      gel10minLbf100ft2: [data.gel10minLbf100ft2 ?? data.rheology?.gel10minLbf100ft2 ?? null],
      gel30minLbf100ft2: [data.gel30minLbf100ft2 ?? data.rheology?.gel30minLbf100ft2 ?? null],
      consistencyBc: [data.consistencyBc ?? null],
      thickeningTimeMin: [data.thickeningTimeMin ?? null],
      fluidLossCc30min: [data.fluidLossCc30min ?? null],
      freeWaterMl: [data.freeWaterMl ?? null],
      rpm300: [data.rpm300 ?? fann.rpm300 ?? null],
      rpm200: [data.rpm200 ?? fann.rpm200 ?? null],
      rpm100: [data.rpm100 ?? fann.rpm100 ?? null],
      rpm60: [data.rpm60 ?? fann.rpm60 ?? null],
      rpm30: [data.rpm30 ?? fann.rpm30 ?? null],
      rpm6: [data.rpm6 ?? fann.rpm6 ?? null],
      rpm3: [data.rpm3 ?? fann.rpm3 ?? null],
      temperaturaTesteF: [data.temperaturaTesteF ?? null],
      pressaoTestePsi: [data.pressaoTestePsi ?? null],
      tempoCondicionamentoMin: [data.tempoCondicionamentoMin ?? null],
      concentracaoTeste: [data.concentracaoTeste ?? null],
      unidadeConcentracaoTeste: [data.unidadeConcentracaoTeste ?? ''],
      pvDeltaPerUnit: [coefficients.pvDeltaPerUnit ?? null],
      ypDeltaPerUnit: [coefficients.ypDeltaPerUnit ?? null],
      gel10sDeltaPerUnit: [coefficients.gel10sDeltaPerUnit ?? null],
      gel10minDeltaPerUnit: [coefficients.gel10minDeltaPerUnit ?? null],
      gel30minDeltaPerUnit: [coefficients.gel30minDeltaPerUnit ?? null],
      frictionFactorMultiplier: [coefficients.frictionFactorMultiplier ?? null],
      frictionFactorMultiplierDeltaPerUnit: [coefficients.frictionFactorMultiplierDeltaPerUnit ?? null],
      consistencyDeltaPerUnit: [coefficients.consistencyDeltaPerUnit ?? null],
      thickeningTimeDeltaMinPerUnit: [coefficients.thickeningTimeDeltaMinPerUnit ?? null],
      fluidLossReductionFactorPerUnit: [coefficients.fluidLossReductionFactorPerUnit ?? null],
      compativelComAguaDoce: [data.compativelComAguaDoce ?? false],
      compativelComAguaMar: [data.compativelComAguaMar ?? false],
      compativelComSalmoura: [data.compativelComSalmoura ?? false],
      compativelComLatex: [data.compativelComLatex ?? false],
      compativelComSilica: [data.compativelComSilica ?? false],
      compativelComEspumada: [data.compativelComEspumada ?? false],
      riscoEspuma: [data.riscoEspuma ?? false],
      observacoesOperacionais: [data.observacoesOperacionais ?? ''],
      observacoesLaboratorio: [data.observacoesLaboratorio ?? ''],
      fonteDados: [data.fonteDados ?? ''],
    });
  }

  private toAditivo(group: FormGroup): Aditivo {
    const v = group.getRawValue();
    return {
      ...v,
      estadoFisico: v.type,
      categoria: v.category,
      concentracaoUsada: v.conc,
      coefficients: {
        pvDeltaPerUnit: this.nullableNumber(v.pvDeltaPerUnit),
        ypDeltaPerUnit: this.nullableNumber(v.ypDeltaPerUnit),
        gel10sDeltaPerUnit: this.nullableNumber(v.gel10sDeltaPerUnit),
        gel10minDeltaPerUnit: this.nullableNumber(v.gel10minDeltaPerUnit),
        gel30minDeltaPerUnit: this.nullableNumber(v.gel30minDeltaPerUnit),
        frictionFactorMultiplier: this.nullableNumber(v.frictionFactorMultiplier),
        frictionFactorMultiplierDeltaPerUnit: this.nullableNumber(v.frictionFactorMultiplierDeltaPerUnit),
        consistencyDeltaPerUnit: this.nullableNumber(v.consistencyDeltaPerUnit),
        thickeningTimeDeltaMinPerUnit: this.nullableNumber(v.thickeningTimeDeltaMinPerUnit),
        fluidLossReductionFactorPerUnit: this.nullableNumber(v.fluidLossReductionFactorPerUnit),
      },
    } as Aditivo;
  }

  private legacyUnit(unit?: string, type?: string): UnidadeDosagem {
    if (unit && this.unidades.some(u => u.value === unit)) return unit as UnidadeDosagem;
    return type === 'liquid' || unit === 'gpc' ? 'galPerSack' : 'percentBWOC';
  }

  private num(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  private nullableNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
}
