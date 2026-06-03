import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiAccordion } from '@taiga-ui/kit';
import { TuiExpand } from '@taiga-ui/core/components/expand';

import { CoreCalculoService } from '../../services/core-calculo.service';
import { SlurryCalculoService } from '../../services/slurry-calculo.service';
import { TestsCalculoService } from '../../services/tests-calculo.service';
import { SqueezeCalculoService } from '../../services/squeeze-calculo.service';
import { ReverseCirculationCalculoService, ReverseCirculationResult } from '../../services/reverse-circulation-calculo.service';
import { RelatorioViewerComponent } from '../../components/relatorio/relatorio-viewer.component';
import { RelatorioCapaModalComponent, RelatorioCapaData, GraficoOperacionalTipo } from '../../components/relatorio/relatorio-capa-modal.component';
import { RelatorioBuilderService } from '../../components/relatorio/relatorio-builder.service';
import { ThickeningChartComponent } from '../../components/charts/thickening-chart.component';
import { UcaChartComponent } from '../../components/charts/uca-chart.component';
import { OpsChartComponent, OpsPhase } from '../../components/charts/ops-chart.component';
import { SqueezeSchematicsComponent } from '../../components/charts/squeeze-schematics.component';
import { SqueezeOperationChartsComponent } from '../../components/charts/squeeze-operation-charts.component';
import { AditivoModalComponent } from '../../components/aditivos/aditivo-modal.component';
import { SimuladorStateModalComponent } from '../../components/state-modal/simulador-state-modal.component';
import { SqueezeHydraulicSimulationService } from '../../services/squeeze-hydraulic-simulation.service';
import { RheologyAdjustmentService, RheologyAdjustmentResult, BASE_SLURRY_RHEOLOGY } from '../../services/rheology-adjustment.service';
import { AditivosStoreService } from '../../services/aditivos-store.service';
import { SimuladorStateStoreService, DadosRelatorio } from '../../services/simulador-state-store.service';

import { SqueezeGeometry, SqueezeInputs, Perfuracao, SqueezeHydraulicSimulation } from '../../models/squeeze.model';
import { CementSlurryRecipeRow, SlurryDesign, SlurryRecipe, Diagnostic, SlurryRecipeByVolume } from '../../models/pasta.model';
import { ThickeningResult, UCAResult } from '../../models/reologia.model';
import { ADITIVOS_CATALOGO, AditivoCatalogo, Aditivo, hydrateAditivosFromCatalog, unidadePadraoAditivo } from '../../models/aditivo.model';
import { Rheology } from '../../models/reologia.model';
import { CEMENT_CLASSES } from '../../models/constantes';
import { API_CASING_SIZES, API_TUBING_SIZES, ApiTubular } from '../../models/api-tubulares';

type TabId = 'recipe' | 'rheology' | 'simulations' | 'schematic';

@Component({
  selector: 'app-simulador-squeeze',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RelatorioViewerComponent,
    ThickeningChartComponent,
    UcaChartComponent,
    OpsChartComponent,
    SqueezeSchematicsComponent,
    SqueezeOperationChartsComponent,
    AditivoModalComponent,
    SimuladorStateModalComponent,
    RelatorioCapaModalComponent,
    TuiButton,
    TuiIcon,
    ...TuiAccordion,
    TuiExpand,
  ],
  templateUrl: './simulador-squeeze.component.html',
  styleUrl: './simulador-squeeze.component.css',
})
export class SimuladorSqueezeComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  form!: FormGroup;
  activeTab: TabId = 'recipe';
  readonly tabs: { id: TabId; label: string }[] = [
    { id: 'recipe', label: '1. Receita / Volumes' },
    { id: 'rheology', label: '2. Reologia' },
    { id: 'simulations', label: '3. Simulações' },
    { id: 'schematic', label: '4. Esquemático' },
  ];

  readonly cimentoClasses = Object.entries(CEMENT_CLASSES).map(([k, v]) => ({ value: k, label: v.label }));
  readonly catalogoAditivos: AditivoCatalogo[] = ADITIVOS_CATALOGO;

  geom: SqueezeGeometry | null = null;
  slurry: SlurryDesign | null = null;
  recipe: SlurryRecipe | null = null;
  squeezeInputsSnapshot: SqueezeInputs | null = null;
  tt: ThickeningResult | null = null;
  uca: UCAResult | null = null;
  rheoDiags: Diagnostic[] = [];
  recipeDiags: Diagnostic[] = [];
  fracResult: { fracPsi: number; porePsi: number; squeezePsi: number } | null = null;
  hydraulicSim: SqueezeHydraulicSimulation | null = null;
  rheologyResult: RheologyAdjustmentResult | null = null;
  reverseCirculation: ReverseCirculationResult | null = null;
  freeWater = 0;
  geoFormula = '';
  opsPhases: OpsPhase[] = [];

  relatorioVisivel = false;
  relatorioTitulo = '';
  relatorioConteudo = '';
  capaModalOpen = false;
  aditivosModalOpen = false;
  stateModalOpen = false;

  @ViewChild('stateModal') stateModal!: SimuladorStateModalComponent;
  @ViewChild('reportSchematics') reportSchematics?: SqueezeSchematicsComponent;
  @ViewChild('reportOpsChart') reportOpsChart?: OpsChartComponent;
  @ViewChild('reportPressureCharts') reportPressureCharts?: SqueezeOperationChartsComponent;

  // Sidebar toggle
  sidebarOpen = true;

  // Accordion sidebar
  sec1Open = true;
  sec2Open = true;
  sec3Open = false;
  sec4Open = false;
  sec5Open = false;
  sec6Open = false;
  sec7Open = false;
  sec8Open = false;

  dadosRelatorio: DadosRelatorio = {};

  readonly casingOptions: ApiTubular[] = API_CASING_SIZES;
  readonly tubingOptions: ApiTubular[] = API_TUBING_SIZES;

  // Receita por volume manual
  manualVolumeBbl = 5;
  manualYieldFt3: number | null = null;
  manualFacGpc: number | null = null;
  manualFamGpc: number | null = null;
  manualRecipeResult: SlurryRecipeByVolume | null = null;

  constructor(
    private fb: FormBuilder,
    private coreCalc: CoreCalculoService,
    private slurryCalc: SlurryCalculoService,
    private testsCalc: TestsCalculoService,
    private squeezeCalc: SqueezeCalculoService,
    private reverseCirculationCalc: ReverseCirculationCalculoService,
    private squeezeHydraulics: SqueezeHydraulicSimulationService,
    private rheologyAdj: RheologyAdjustmentService,
    private aditivosStore: AditivosStoreService,
    private relatorioBuilder: RelatorioBuilderService,
    private stateStore: SimuladorStateStoreService,
  ) {}

  ngOnInit(): void {
    this.dadosRelatorio = this.stateStore.loadDadosRelatorio('squeeze');
    this.buildForm();
    this.restoreAditivos();
    this.simulate();
    this.form.valueChanges
      .pipe(debounceTime(350), takeUntil(this.destroy$))
      .subscribe({ next: () => { try { this.simulate(); } catch (e) { console.error('[squeeze] simulate error:', e); } } });
    this.additivos.valueChanges
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe(() => this.aditivosStore.save('squeeze', this.additivos.getRawValue()));
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private restoreAditivos(): void {
    const saved = this.aditivosStore.load('squeeze') as any[];
    saved.forEach(data => this.additivos.push(this.createAditivoGroup(data)));
  }

  onExportJson(): void {
    this.aditivosStore.exportJson('squeeze', this.additivos.getRawValue());
  }

  onImportJson(data: unknown[]): void {
    while (this.additivos.length) this.additivos.removeAt(0);
    (data as any[]).forEach(d => this.additivos.push(this.createAditivoGroup(d)));
    this.aditivosStore.save('squeeze', this.additivos.getRawValue());
  }

  get additivos(): FormArray { return this.form.get('additivos') as FormArray; }
  get perforacoes(): FormArray { return this.form.get('perforacoes') as FormArray; }

  private buildForm(): void {
    this.form = this.fb.group({
      sectionStartMD: [1400], sectionEndMD: [1500],
      sectionStartTVD: [1400], sectionEndTVD: [1500],
      wellFinalMD: [1500], wellFinalTVD: [1500],
      caliper: [8.535],
      casingOD: [5.500], casingID: [4.778],
      tubingOD: [2.875], tubingID: [2.441],
      backSpacerHeight: [50],
      surfaceTemp: [80.6], geoGradient: [1.50],
      bhst: [{ value: null, disabled: true }],
      bhct: [{ value: null, disabled: true }],
      mudWeightFront: [9.5], mudWeightBack: [9.5], completionWeight: [9.5],
      fracGrad: [16.0], poreGrad: [9.0], pumpRate: [2.0],
      surfacePressure: [0],
      squeezeTestPressure: [400],
      pressaoOperacao: [2000],
      volMaxInjetadoBbl: [2.0],
      expectedLoss: [0],
      pause1: [0], pause2: [0], pause3: [0],
      density: [15.8], cementClass: ['G'],
      waterSplitFresh: [100], waterSplitSea: [0],
      silica: [35], nacl: [0],
      theta300: [181], theta200: [132], theta100: [79],
      theta60: [53], theta30: [31], theta20: [23],
      theta10: [13], theta6: [9], theta3: [6],
      additivos: this.fb.array([]),
      perforacoes: this.fb.array([
        this.fb.group({ top: [1420], base: [1440] }),
      ]),
    });
  }

  simulate(): void {
    try {
      const v = this.form.getRawValue();
      const perfs: Perfuracao[] = (v.perforacoes || []).map((p: any) => ({ top: +p.top, base: +p.base }));

      const bht = this.coreCalc.calcBHT(v.surfaceTemp, v.geoGradient, v.sectionEndTVD);
      this.form.patchValue({ bhst: bht.bhst, bhct: bht.bhct }, { emitEvent: false });
      this.geoFormula = bht.formula;

      const vWithBHT = { ...v, bhct: bht.bhct, bhst: bht.bhst };

      this.squeezeInputsSnapshot = v as SqueezeInputs;
      this.geom = this.squeezeCalc.calcVolumes(v, perfs);
      this.reverseCirculation = this.buildReverseCirculationResult(v);
      const thetaReadings = this.buildThetaReadings(v);
      const aditivosRaw = hydrateAditivosFromCatalog((v.additivos || []) as Aditivo[]);

      this.slurry = this.slurryCalc.calculateSlurryDesign({ ...vWithBHT, additivos: aditivosRaw } as any);
      this.recipe = this.slurryCalc.buildSlurryRecipe(this.geom.slurryTotal, this.slurry);
      this.manualRecipeResult = this.slurryCalc.buildSlurryRecipe(this.manualVolumeBbl, this.slurry).volumeRecipe ?? null;

      this.tt = this.testsCalc.simulateThickening(this.slurry, v.sectionEndTVD, thetaReadings);
      this.uca = this.testsCalc.simulateUCA(this.slurry, this.tt);
      this.freeWater = this.testsCalc.estimateFreeWater(this.slurry);
      this.rheoDiags = this.testsCalc.rheoDiagnostics(this.slurry, this.tt, this.freeWater);
      this.fracResult = this.squeezeCalc.calcFractureGradient(this.geom, v);

      this.rheologyResult = this.rheologyAdj.applyAdditiveRheologyEffects(BASE_SLURRY_RHEOLOGY, aditivosRaw, { thetaReadings });
      this.hydraulicSim = this.squeezeHydraulics.simulate(this.geom, this.slurry, v, perfs, aditivosRaw, { thetaReadings });

      this.buildOpsPhases();
      this.buildRecipeDiags();
    } catch (e) {
      console.error('[squeeze] simulate error:', e);
    }
  }

  private buildReverseCirculationResult(v: any): ReverseCirculationResult | null {
    try {
      return this.reverseCirculationCalc.calculateReverseCirculation({
        tubingIdIn: Number(v.tubingID),
        openEndDepthM: Number(v.sectionEndMD),
      });
    } catch {
      return null;
    }
  }

  private buildOpsPhases(): void {
    if (!this.geom || !this.tt) return;
    const v = this.form.getRawValue();
    const rate = v.pumpRate || 2;
    const bbl2min = (vol: number) => rate > 0 ? Math.max(0, vol || 0) / rate : 0;
    const pause1 = Math.max(0, Number(v.pause1) || 0);
    const pause2 = Math.max(0, Number(v.pause2) || 0);
    const pause3 = Math.max(0, Number(v.pause3) || 0);
    this.opsPhases = [
      { label: 'Fl. Frente', durationMin: bbl2min(this.geom.frontPhysicalVolumeBbl), color: '#bae6fd' },
      ...(pause1 > 0 ? [{ label: 'Pausa 1', durationMin: pause1, color: '#cbd5e1' }] : []),
      { label: 'Pasta', durationMin: bbl2min(this.geom.slurryTotal), color: '#bbf7d0' },
      ...(pause2 > 0 ? [{ label: 'Pausa 2', durationMin: pause2, color: '#94a3b8' }] : []),
      { label: 'Fl. Atrás', durationMin: bbl2min(this.geom.volBackSpacer), color: '#e9d5ff' },
      ...(pause3 > 0 ? [{ label: 'Pausa 3', durationMin: pause3, color: '#64748b' }] : []),
      { label: 'Deslocamento', durationMin: bbl2min(this.geom.operationalDisplacementVolumeBbl), color: '#fed7aa' },
    ].filter(phase => phase.durationMin > 0);
  }

  private buildRecipeDiags(): void {
    if (!this.geom || !this.tt) return;
    const diags: Diagnostic[] = [];
    const pumpTime = this.opsPhases.reduce((s, p) => s + p.durationMin, 0);
    const tt50min = this.tt.t50 * 60;
    if (pumpTime > tt50min * 0.85) diags.push({ text: 'Tempo de bombeio próximo do TT 50 Bc', cls: 'danger' });
    else if (pumpTime > tt50min * 0.70) diags.push({ text: 'Margem de TT moderada', cls: 'warn' });
    else diags.push({ text: 'Margem de TT confortável', cls: 'ok' });
    if (this.geom.expectedLoss > 0) diags.push({ text: `Perda esperada: ${this.fmt(this.geom.expectedLoss)} bbl injetados`, cls: 'info' });
    this.recipeDiags = diags;
  }

  setTab(tab: TabId): void { this.activeTab = tab; }

  addPerfuracao(): void {
    const last = this.perforacoes.length > 0
      ? this.perforacoes.at(this.perforacoes.length - 1).value
      : { top: 1420, base: 1440 };
    this.perforacoes.push(this.fb.group({ top: [last.base + 10], base: [last.base + 30] }));
  }

  removePerfuracao(i: number): void {
    if (this.perforacoes.length > 1) this.perforacoes.removeAt(i);
  }

  openAditivosModal(): void { this.aditivosModalOpen = true; }

  closeAditivosModal(): void { this.aditivosModalOpen = false; }

  openStateModal(): void {
    this.stateModal?.setCurrentForm({
      ...this.form.getRawValue(),
      _dadosRelatorio: this.dadosRelatorio,
      _manualVolumeBbl: this.manualVolumeBbl,
      _manualYieldFt3: this.manualYieldFt3,
      _manualFacGpc: this.manualFacGpc,
      _manualFamGpc: this.manualFamGpc,
    });
    this.stateModalOpen = true;
  }

  closeStateModal(): void { this.stateModalOpen = false; }

  onCarregarEstado(formValue: Record<string, unknown>): void {
    const { additivos, perforacoes, casingOD, casingID, tubingOD, tubingID, caliper,
            _dadosRelatorio, _manualVolumeBbl, _manualYieldFt3, _manualFacGpc, _manualFamGpc,
            ...rest } = formValue as any;
    this.form.patchValue(rest, { emitEvent: false });
    if (_dadosRelatorio) {
      this.dadosRelatorio = _dadosRelatorio;
      this.saveDadosRelatorio();
    }
    if (_manualVolumeBbl != null) this.manualVolumeBbl = +_manualVolumeBbl;
    if (_manualYieldFt3 != null) this.manualYieldFt3 = +_manualYieldFt3;
    if (_manualFacGpc != null) this.manualFacGpc = +_manualFacGpc;
    if (_manualFamGpc != null) this.manualFamGpc = +_manualFamGpc;
    while (this.additivos.length) this.additivos.removeAt(0);
    if (Array.isArray(additivos)) {
      additivos.forEach((d: any) => this.additivos.push(this.createAditivoGroup(d)));
    }
    while (this.perforacoes.length > 0) this.perforacoes.removeAt(0);
    if (Array.isArray(perforacoes) && perforacoes.length > 0) {
      perforacoes.forEach((p: any) => this.perforacoes.push(this.fb.group({ top: [p.top], base: [p.base] })));
    } else {
      this.perforacoes.push(this.fb.group({ top: [1420], base: [1440] }));
    }
    this.simulate();
  }

  private createAditivoGroup(data: Partial<AditivoCatalogo & { conc: number; coefficients?: any }> = {}): FormGroup {
    const cat = ADITIVOS_CATALOGO.find(c => c.catalogId === data.catalogId);
    const source = { ...cat, ...data } as Partial<Aditivo>;
    return this.fb.group({
      catalogId: [data.catalogId ?? ''],
      name: [data.name ?? cat?.name ?? '', Validators.required],
      funcaoPrincipal: [data.funcaoPrincipal ?? cat?.funcaoPrincipal ?? cat?.primaryFunction ?? ''],
      conc: [data.conc ?? data.defaultConc ?? 0, [Validators.required, Validators.min(0)]],
      unidadeDosagem: [data.unidadeDosagem ?? unidadePadraoAditivo(source)],
      misturadoEm: [data.misturadoEm ?? cat?.misturadoEm ?? 'aguaMistura'],
      ativo: [data.ativo ?? true],
    });
  }

  addAditivo(): void {
    this.additivos.push(this.createAditivoGroup({ name: 'Novo Aditivo', category: 'retarder', type: 'liquid', conc: 0.03 }));
  }

  addAditivoCatalogo(cat: AditivoCatalogo): void {
    this.additivos.push(this.createAditivoGroup(cat));
  }

  removeAditivo(i: number): void { this.additivos.removeAt(i); }

  aditivoUnit(i: number): string {
    const ad = this.additivos.at(i);
    const unit = ad?.get('unidadeDosagem')?.value;
    return unit === 'percentBWOW' ? '% BWOW' : unit === 'percentBWOC' ? '% BWOC' : 'GPC';
  }

  rheologySourceLabel(): string {
    const source = this.rheologyResult?.source;
    if (source === 'laboratorio' || source === 'theta') return 'Laboratório';
    if (source === 'catalogo') return 'Catálogo';
    if (source === 'estimado') return 'Estimado';
    return 'Base';
  }

  private buildThetaReadings(v: any): Rheology {
    return {
      theta300: +v.theta300,
      theta200: +v.theta200,
      theta100: +v.theta100,
      theta60: +v.theta60,
      theta30: +v.theta30,
      theta20: +v.theta20,
      theta10: +v.theta10,
      theta6: +v.theta6,
      theta3: +v.theta3,
    };
  }

  onCasingSelect(idx: string): void {
    if (idx === '') return;
    const c = this.casingOptions[+idx];
    if (!c) return;
    this.form.patchValue({ casingOD: c.odIn, casingID: c.idIn });
  }

  onTubingSelect(idx: string): void {
    if (idx === '') return;
    const t = this.tubingOptions[+idx];
    if (!t) return;
    this.form.patchValue({ tubingOD: t.odIn, tubingID: t.idIn });
  }

  calcManualRecipe(): void {
    if (!this.slurry) return;
    const fac    = this.manualFacGpc;
    const fam    = this.manualFamGpc;
    const yield3 = this.manualYieldFt3 ?? this.recipe?.baseRecipe?.yieldFt3PerFt3Cement ?? null;

    if (fac !== null && fac > 0 && yield3 !== null && yield3 > 0) {
      this.manualRecipeResult = this.slurryCalc.buildSlurryRecipeByFacFam(
        this.slurry,
        this.manualVolumeBbl,
        fac,
        fam ?? fac,
        yield3,
      );
    } else {
      const rec = this.slurryCalc.buildSlurryRecipe(this.manualVolumeBbl, this.slurry, this.manualYieldFt3);
      this.manualRecipeResult = rec.volumeRecipe ?? null;
    }
  }

  fmt(v: number | null | undefined, dec = 2): string {
    if (v == null || !Number.isFinite(v)) return '-';
    return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  kgFromLb(v: number | null | undefined): number | null {
    return v == null || !Number.isFinite(v) ? null : v * 0.45359237;
  }

  litersFromGal(v: number | null | undefined): number | null {
    return v == null || !Number.isFinite(v) ? null : v * 3.785411784;
  }

  recipeQuantity(row: CementSlurryRecipeRow, scaled = false): number {
    if (this.isMassRecipeRow(row)) {
      return scaled
        ? (row.scaledMassKg ?? row.baseMassLb * 0.45359237)
        : row.baseMassLb * 0.45359237;
    }

    const gal = scaled ? (row.scaledVolumeGal ?? row.baseVolumeGal) : row.baseVolumeGal;
    return gal * 3.785411784;
  }

  recipeQuantityUnit(row: CementSlurryRecipeRow): 'kg' | 'L' {
    return this.isMassRecipeRow(row) ? 'kg' : 'L';
  }

  recipeQuantityText(row: CementSlurryRecipeRow, scaled = false): string {
    return `${this.fmt(this.recipeQuantity(row, scaled), scaled ? 1 : 3)} ${this.recipeQuantityUnit(row)}`;
  }

  recipeConcentrationText(row: CementSlurryRecipeRow): string {
    if (row.concentration === 'base') return row.concentrationUnit;
    const value = typeof row.concentration === 'number' ? this.fmt(row.concentration, 4) : row.concentration;
    return `${value}${row.concentrationUnit}`;
  }

  recipeItemLabel(row: CementSlurryRecipeRow): string {
    const labels: Record<string, string> = {
      cement: 'Cimento',
      water: 'Agua',
      liquidAdditive: this.additiveCategoryLabel(row),
      solidAdditive: this.additiveCategoryLabel(row),
      salt: 'Sal',
      silica: 'Silica',
    };
    return labels[row.type] ?? row.productName;
  }

  recipeCode(row: CementSlurryRecipeRow): string {
    return row.type === 'liquidAdditive' || row.type === 'solidAdditive' || row.type === 'salt' || row.type === 'silica'
      ? row.productName
      : '';
  }

  private isMassRecipeRow(row: CementSlurryRecipeRow): boolean {
    return row.type === 'cement' || row.type === 'solidAdditive' || row.type === 'salt' || row.type === 'silica';
  }

  private additiveCategoryLabel(row: CementSlurryRecipeRow): string {
    const name = row.productName.toLowerCase();
    if (name.includes('def') || name.includes('anti')) return 'Antiespumante';
    if (name.includes('bqflux') || name.includes('bq-20') || name.includes('dispers')) return 'Dispersante';
    if (name.includes('bqfl') || name.includes('fl-') || name.includes('polytrol')) return 'Controlador de filtrado';
    if (name.includes('bqrt') || name.includes('retard')) return 'Retardador';
    if (name.includes('bqac') || name.includes('aceler')) return 'Acelerador';
    return 'Aditivo';
  }

  fmtTime(h: number): string {
    if (!Number.isFinite(h)) return '-';
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${hh}h ${mm.toString().padStart(2, '0')}min`;
  }

  saveDadosRelatorio(): void {
    this.stateStore.saveDadosRelatorio('squeeze', this.dadosRelatorio);
  }

  onMechanicalSchematicSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Selecione uma imagem com no máximo 5 MB.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.dadosRelatorio.esquemaMecanicoNome = file.name;
      this.dadosRelatorio.esquemaMecanicoImagem = String(reader.result || '');
      this.saveDadosRelatorio();
    };
    reader.readAsDataURL(file);
  }

  onCapaGerada(data: RelatorioCapaData): void {
    const v = this.form.getRawValue();
    this.dadosRelatorio.tipoReceitaRelatorio = data.tipoReceitaRelatorio ?? 'volume';
    this.dadosRelatorio.esquematicosSelecionados = data.esquematicosSelecionados;
    this.dadosRelatorio.sequenciaOperacional = data.sequenciaOperacional as any;
    this.dadosRelatorio.esquemaMecanicoNome = data.esquemaMecanicoNome;
    this.dadosRelatorio.esquemaMecanicoImagem = data.esquemaMecanicoImagem;
    this.dadosRelatorio.secoesPersonalizadas = data.secoesPersonalizadas ?? [];
    this.saveDadosRelatorio();
    const tubingODFormatted = v.tubingOD ? `${this.fmt(v.tubingOD, 3)}"` : '';
    const reverseCircBbl = this.reverseCirculation?.reverseCirculationVolumeBbl ?? 0;
    this.captureGraficosImages(data.graficosOperacionaisSelecionados ?? []).then(graficosImages => {
      const reportHtml = this.relatorioBuilder.buildCapa({
        ...data,
        zonaIsolarNome: data.zonaIsolarNome || this.dadosRelatorio.zonaIsolarNome,
        zonaIsolarTopo: String(v.sectionStartTVD ?? ''),
        zonaIsolarBase: String(v.sectionEndTVD ?? ''),
        topoCimento: String(v.sectionStartMD ?? ''),
        baseTampao: String(v.sectionEndMD ?? ''),
        revestimento: this.formatCasing(v.casingOD, v.casingID),
        geoGradient: v.geoGradient,
        bhst: v.bhst,
        bhct: v.bhct,
        bombeioRows: this.buildRelatorioBombeioRows(v, data.tipoReceitaRelatorio ?? 'volume'),
        receitaRows: this.buildRelatorioReceitaRows(data.tipoReceitaRelatorio ?? 'volume'),
        esquematicoImages: this.reportSchematics?.getReportImages(data.esquematicosSelecionados),
        graficosOperacionaisImages: graficosImages,
        sequenciaOperacional: {
          ...data.sequenciaOperacional,
          colunaTrabalho: tubingODFormatted || data.sequenciaOperacional?.colunaTrabalho || '',
          colunaProfundidadeM: v.sectionEndMD ?? data.sequenciaOperacional?.colunaProfundidadeM ?? '',
          testeInjetividadeDefinidoPor: data.cliente || data.origem || 'ORIGEM',
          pressaoTesteLinhasPsi: (Number(v.pressaoOperacao) || 2000) + 1000,
          volumeCirculacaoReversaBbl: reverseCircBbl,
          pressaoMaxSqueezePsi: Number(v.pressaoOperacao) || 2000,
          volumeMaxInjetadoBbl: Number(v.volMaxInjetadoBbl) || 2,
        },
      });
      this.relatorioBuilder.openInNewTab(reportHtml);
    });
  }

  private buildRelatorioReceitaRows(tipo: RelatorioCapaData['tipoReceitaRelatorio']): RelatorioCapaData['receitaRows'] {
    const useVolume = tipo === 'volume' && !!this.manualRecipeResult?.rows?.length;
    const rows = useVolume ? this.manualRecipeResult!.rows : (this.recipe?.baseRecipe?.rows || []);
    return rows.map(row => ({
      aditivo: this.recipeItemLabel(row),
      codigo: this.recipeCode(row),
      concentracao: this.recipeConcentrationText(row),
      quantidade: this.recipeQuantityText(row, useVolume),
    }));
  }

  private buildRelatorioBombeioRows(v: any, tipoReceita?: string): RelatorioCapaData['bombeioRows'] {
    const pumpRate = Number(v.pumpRate) || 0;
    const slurryDensity = Number(this.slurry?.density ?? v.density);
    const pastaLabel = Number.isFinite(slurryDensity) ? `Pasta ${this.fmt(slurryDensity, 1)} ppg` : 'Pasta';
    const useManual = tipoReceita === 'volume' && !!this.manualRecipeResult?.targetSlurryVolumeBbl;
    const slurryVolBbl = useManual ? this.manualRecipeResult!.targetSlurryVolumeBbl : (this.geom?.slurryTotal ?? 0);
    return [
      { fluido: 'Fluido a frente', volumeBbl: this.geom?.washVolFront ?? this.geom?.frontPhysicalVolumeBbl ?? 0, vazaoBpm: pumpRate, densidadePpg: v.mudWeightFront },
      { fluido: pastaLabel, volumeBbl: slurryVolBbl, vazaoBpm: pumpRate, densidadePpg: slurryDensity },
      { fluido: 'Fluido atras', volumeBbl: this.geom?.volBackSpacer ?? 0, vazaoBpm: pumpRate, densidadePpg: v.mudWeightBack },
      { fluido: 'Deslocamento', volumeBbl: this.geom?.displacementVolume ?? this.geom?.operationalDisplacementVolumeBbl ?? 0, vazaoBpm: pumpRate, densidadePpg: v.completionWeight },
    ];
  }

  private async captureGraficosImages(selecionados: GraficoOperacionalTipo[]): Promise<{ label: string; imagem: string }[]> {
    const result: { label: string; imagem: string }[] = [];
    if (selecionados.includes('cronograma') && this.reportOpsChart) {
      const imgs = await this.reportOpsChart.renderForReport();
      result.push(...imgs);
    }
    if (selecionados.includes('pressao') && this.reportPressureCharts) {
      const imgs = await this.reportPressureCharts.renderForReport();
      result.push(...imgs);
    }
    return result;
  }

  private formatCasing(od: unknown, id: unknown): string {
    const odText = this.formatInches(od);
    const idText = this.formatInches(id);
    return [odText ? `OD ${odText}` : '', idText ? `ID ${idText}` : ''].filter(Boolean).join(' | ');
  }

  private formatInches(value: unknown): string {
    const n = Number(value);
    return Number.isFinite(n) ? `${this.fmt(n, 3)} in` : '';
  }

}
