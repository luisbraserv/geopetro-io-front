import { Component, OnInit, OnDestroy, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiAccordion } from '@taiga-ui/kit';
import { TuiExpand } from '@taiga-ui/core/components/expand';

import { CoreCalculoService } from '../../services/core-calculo.service';
import { SlurryCalculoService } from '../../services/slurry-calculo.service';
import { TestsCalculoService } from '../../services/tests-calculo.service';
import { TampaoCalculoService } from '../../services/tampao-calculo.service';
import { RelatorioViewerComponent } from '../../components/relatorio/relatorio-viewer.component';
import { ThickeningChartComponent } from '../../components/charts/thickening-chart.component';
import { UcaChartComponent } from '../../components/charts/uca-chart.component';
import { PressureChartComponent } from '../../components/charts/pressure-chart.component';
import { OpsChartComponent, OpsPhase } from '../../components/charts/ops-chart.component';
import { SchematicTampaoComponent } from '../../components/charts/schematic-tampao.component';
import { AditivoModalComponent } from '../../components/aditivos/aditivo-modal.component';
import { SimuladorStateModalComponent } from '../../components/state-modal/simulador-state-modal.component';

import { RheologyAdjustmentService, RheologyAdjustmentResult, BASE_SLURRY_RHEOLOGY } from '../../services/rheology-adjustment.service';
import { AditivosStoreService } from '../../services/aditivos-store.service';

import { PlugGeometry, TampaoInputs, PressureProfile } from '../../models/tampao.model';
import { SlurryDesign, SlurryRecipe, Diagnostic, SlurryRecipeByVolume } from '../../models/pasta.model';
import { ThickeningResult, UCAResult } from '../../models/reologia.model';
import { ADITIVOS_CATALOGO, AditivoCatalogo, Aditivo, hydrateAditivosFromCatalog, unidadePadraoAditivo } from '../../models/aditivo.model';
import { Rheology } from '../../models/reologia.model';
import { CEMENT_CLASSES } from '../../models/constantes';
import { API_CASING_SIZES, API_TUBING_SIZES, ApiTubular } from '../../models/api-tubulares';

type TabId = 'recipe' | 'rheology' | 'pressure' | 'schematic';

@Component({
  selector: 'app-simulador-tampao',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RelatorioViewerComponent,
    ThickeningChartComponent,
    UcaChartComponent,
    PressureChartComponent,
    OpsChartComponent,
    SchematicTampaoComponent,
    AditivoModalComponent,
    SimuladorStateModalComponent,
    TuiButton,
    TuiIcon,
    ...TuiAccordion,
    TuiExpand,
  ],
  templateUrl: './simulador-tampao.component.html',
  styleUrl: './simulador-tampao.component.css',
})
export class SimuladorTampaoComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  form!: FormGroup;
  activeTab: TabId = 'recipe';
  readonly tabs: { id: TabId; label: string }[] = [
    { id: 'recipe', label: '1. Receita / Volumes' },
    { id: 'rheology', label: '2. Reologia' },
    { id: 'pressure', label: '3. Pressão' },
    { id: 'schematic', label: '4. Esquemático' },
  ];

  readonly cimentoClasses = Object.entries(CEMENT_CLASSES).map(([k, v]) => ({ value: k, label: v.label }));
  readonly catalogoAditivos: AditivoCatalogo[] = ADITIVOS_CATALOGO;
  readonly casingOptions: ApiTubular[] = API_CASING_SIZES;
  readonly tubingOptions: ApiTubular[] = API_TUBING_SIZES;
  readonly roughnessOptions = [
    { value: 'low', label: 'Baixa (tubo novo)' },
    { value: 'medium', label: 'Média (campo típico)' },
    { value: 'high', label: 'Alta (corrosão/incrustação)' },
  ];

  // Resultados da simulação
  plug: PlugGeometry | null = null;
  slurry: SlurryDesign | null = null;
  recipe: SlurryRecipe | null = null;
  tt: ThickeningResult | null = null;
  uca: UCAResult | null = null;
  pressureProfile: PressureProfile | null = null;
  rheoDiags: Diagnostic[] = [];
  recipeDiags: Diagnostic[] = [];
  rheologyResult: RheologyAdjustmentResult | null = null;
  freeWater = 0;
  bhctFormula = '';
  geoFormula = '';

  // Receita manual por volume
  manualVolumeBbl = 10;
  manualYieldFt3: number | null = null;
  manualFacGpc: number | null = null;
  manualFamGpc: number | null = null;
  manualRecipeResult: SlurryRecipeByVolume | null = null;

  // Cronograma
  opsPhases: OpsPhase[] = [];

  // Sidebar toggle
  sidebarOpen = true;

  // Accordion sidebar
  sec1Open = true;
  sec2Open = false;
  sec3Open = false;
  sec4Open = true;
  sec5Open = false;
  sec6Open = false;
  sec7Open = false;

  // Relatório
  relatorioVisivel = false;
  relatorioTitulo = '';
  relatorioConteudo = '';
  aditivosModalOpen = false;
  stateModalOpen = false;

  @ViewChild('stateModal') stateModal!: SimuladorStateModalComponent;

  constructor(
    private fb: FormBuilder,
    private coreCalc: CoreCalculoService,
    private slurryCalc: SlurryCalculoService,
    private testsCalc: TestsCalculoService,
    private tampaoCalc: TampaoCalculoService,
    private rheologyAdj: RheologyAdjustmentService,
    private aditivosStore: AditivosStoreService,
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.restoreAditivos();
    this.simulate();
    this.form.valueChanges
      .pipe(debounceTime(350), takeUntil(this.destroy$))
      .subscribe(() => this.simulate());
    this.additivos.valueChanges
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe(() => this.aditivosStore.save('tampao', this.additivos.getRawValue()));
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private restoreAditivos(): void {
    const saved = this.aditivosStore.load('tampao') as any[];
    saved.forEach(data => this.additivos.push(this.createAditivoGroup(data)));
  }

  onExportJson(): void {
    this.aditivosStore.exportJson('tampao', this.additivos.getRawValue());
  }

  onImportJson(data: unknown[]): void {
    while (this.additivos.length) this.additivos.removeAt(0);
    (data as any[]).forEach(d => this.additivos.push(this.createAditivoGroup(d)));
    this.aditivosStore.save('tampao', this.additivos.getRawValue());
  }

  get additivos(): FormArray { return this.form.get('additivos') as FormArray; }

  private buildForm(): void {
    this.form = this.fb.group({
      sectionStartMD: [1400], sectionEndMD: [1500],
      sectionStartTVD: [1400], sectionEndTVD: [1500],
      wellFinalMD: [1500], wellFinalTVD: [1500],
      holeID: [8.535], pipeOD: [3.500], pipeID: [2.764],
      backSpacerHeight: [100],
      hydroBalanceReference: ['stinger'],
      hydroBalanceManualMD: [1500],
      hydroBalanceTolerancePsi: [10],
      surfaceTemp: [80.6], geoGradient: [1.50],
      bhst: [{ value: null, disabled: true }],
      bhct: [{ value: null, disabled: true }],
      completionWeight: [9.5], mudWeightBack: [9.5], mudWeightFront: [9.5],
      fracGrad: [16.0], poreGrad: [9.0], pumpRate: [3.0],
      pause1: [0], pause2: [0], pause3: [0],
      density: [15.8], cementClass: ['G'],
      waterSplitFresh: [100], waterSplitSea: [0],
      silica: [35], nacl: [0],
      theta300: [181], theta200: [132], theta100: [79],
      theta60: [53], theta30: [31], theta20: [23],
      theta10: [13], theta6: [9], theta3: [6],
      centralization: [70], flowStability: [1.0],
      surgeFactor: [1.0], freeFallSensitivity: [1.0],
      roughness: ['medium'],
      motorHP: [1000], pumpEff: [90],
      maxSurfacePressure: [5000], maxPumpRate: [8.0],
      additivos: this.fb.array([]),
    });
  }

  simulate(): void {
    const v = this.form.getRawValue();
    const inputs: TampaoInputs = v as TampaoInputs;

    // BHT
    const bht = this.coreCalc.calcBHT(v.surfaceTemp, v.geoGradient, v.sectionEndTVD);
    this.form.patchValue({ bhst: bht.bhst, bhct: bht.bhct }, { emitEvent: false });
    this.geoFormula = bht.formula;

    const vWithBHT = { ...v, bhct: bht.bhct, bhst: bht.bhst };

    const thetaReadings = this.buildThetaReadings(v);
    const aditivosRaw = hydrateAditivosFromCatalog((v.additivos || []) as Aditivo[]);

    this.plug = this.tampaoCalc.calcPlug(inputs);
    this.slurry = this.slurryCalc.calculateSlurryDesign({ ...vWithBHT, additivos: aditivosRaw } as any);
    this.recipe = this.slurryCalc.buildSlurryRecipe(this.plug.volCementTotal, this.slurry);
    this.manualRecipeResult = this.slurryCalc.buildSlurryRecipe(this.manualVolumeBbl, this.slurry).volumeRecipe ?? null;

    this.tt = this.testsCalc.simulateThickening(this.slurry, v.sectionEndTVD, thetaReadings);
    this.uca = this.testsCalc.simulateUCA(this.slurry, this.tt);
    this.freeWater = this.testsCalc.estimateFreeWater(this.slurry);
    this.rheoDiags = this.testsCalc.rheoDiagnostics(this.slurry, this.tt, this.freeWater);

    this.rheologyResult = this.rheologyAdj.applyAdditiveRheologyEffects(BASE_SLURRY_RHEOLOGY, aditivosRaw, { thetaReadings });

    this.pressureProfile = this.tampaoCalc.calcPressureProfile(this.plug, this.slurry, inputs);

    this.buildOpsPhases();
    this.buildRecipeDiags();
  }

  private buildOpsPhases(): void {
    if (!this.plug || !this.slurry || !this.tt) return;
    const v = this.form.getRawValue();
    const rate = v.pumpRate || 3;
    const bbl2min = (vol: number) => rate > 0 ? Math.max(0, vol || 0) / rate : 0;
    const pause1 = Math.max(0, Number(v.pause1) || 0);
    const pause2 = Math.max(0, Number(v.pause2) || 0);
    const pause3 = Math.max(0, Number(v.pause3) || 0);
    this.opsPhases = [
      { label: 'Fl. Frente', durationMin: bbl2min(this.plug.volWashTotal), color: '#bae6fd' },
      ...(pause1 > 0 ? [{ label: 'Pausa 1', durationMin: pause1, color: '#cbd5e1' }] : []),
      { label: 'Pasta', durationMin: bbl2min(this.plug.volCementTotal), color: '#bbf7d0' },
      ...(pause2 > 0 ? [{ label: 'Pausa 2', durationMin: pause2, color: '#94a3b8' }] : []),
      { label: 'Fl. Atrás', durationMin: bbl2min(this.plug.volBackSpacer), color: '#e9d5ff' },
      ...(pause3 > 0 ? [{ label: 'Pausa 3', durationMin: pause3, color: '#64748b' }] : []),
      { label: 'Deslocamento', durationMin: bbl2min(this.plug.volDisplacement), color: '#fed7aa' },
    ].filter(phase => phase.durationMin > 0);
  }

  private buildRecipeDiags(): void {
    if (!this.plug || !this.slurry || !this.tt) return;
    const v = this.form.getRawValue();
    const diags: Diagnostic[] = [];
    const pumpTime = this.opsPhases.reduce((s, p) => s + p.durationMin, 0);
    const tt50min = this.tt.t50 * 60;
    if (pumpTime > tt50min * 0.85) diags.push({ text: 'Tempo de bombeio próximo do TT 50 Bc', cls: 'danger' });
    else if (pumpTime > tt50min * 0.70) diags.push({ text: 'Margem de TT moderada', cls: 'warn' });
    else diags.push({ text: 'Margem de TT confortável', cls: 'ok' });
    if (this.plug.volCementTotal < 0.5) diags.push({ text: 'Volume de pasta muito pequeno', cls: 'warn' });
    this.recipeDiags = diags;
  }

  setTab(tab: TabId): void { this.activeTab = tab; }

  openAditivosModal(): void { this.aditivosModalOpen = true; }

  closeAditivosModal(): void { this.aditivosModalOpen = false; }

  openStateModal(): void {
    this.stateModal?.setCurrentForm(this.form.getRawValue());
    this.stateModalOpen = true;
  }

  closeStateModal(): void { this.stateModalOpen = false; }

  onCarregarEstado(formValue: Record<string, unknown>): void {
    const { additivos, ...rest } = formValue as any;
    this.form.patchValue(rest, { emitEvent: false });
    while (this.additivos.length) this.additivos.removeAt(0);
    if (Array.isArray(additivos)) {
      additivos.forEach((d: any) => this.additivos.push(this.createAditivoGroup(d)));
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
    this.form.patchValue({ holeID: c.idIn });
  }

  onTubingSelect(idx: string): void {
    if (idx === '') return;
    const t = this.tubingOptions[+idx];
    if (!t) return;
    this.form.patchValue({ pipeOD: t.odIn, pipeID: t.idIn });
  }

  calcManualRecipe(): void {
    if (!this.slurry) return;
    const fac   = this.manualFacGpc;
    const fam   = this.manualFamGpc;
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

  fmtTime(h: number): string {
    if (!Number.isFinite(h)) return '-';
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${hh}h ${mm.toString().padStart(2, '0')}min`;
  }

  abrirRelatorioReceita(): void {
    if (!this.plug || !this.slurry || !this.recipe) return;
    const html = this.buildRelatorioReceita();
    this.relatorioTitulo = 'Cálculo da Receita — Tampão Balanceado';
    this.relatorioConteudo = html;
    this.relatorioVisivel = true;
  }

  private buildRelatorioReceita(): string {
    const p = this.plug!, sl = this.slurry!, rec = this.recipe!;
    const rows = rec.recipeItems.map(i => `<tr><td>${i.name}</td><td>${i.conc}</td><td>${this.fmt(i.per, 4)}</td><td>${this.fmt(i.total, 2)}</td><td>${i.unit}</td></tr>`).join('');
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Receita</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;font-size:13px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f1f5f9}h2{color:#1e293b}</style></head>
    <body><h2>Tampão Balanceado — Cálculo da Receita</h2>
    <p><b>Volume total de pasta:</b> ${this.fmt(p.volCementTotal)} bbl | <b>Sacos:</b> ${rec.sacks} sk | <b>Densidade:</b> ${this.fmt(sl.density)} ppg | <b>Rendimento:</b> ${this.fmt(sl.yieldLPerSk)} L/sk</p>
    <p><b>Nota de reologia/aditivos:</b> efeitos baixo/medio/alto sao estimativas operacionais por familia quimica e concentracao. Nao substituem ensaio de laboratorio/API.</p>
    <table><thead><tr><th>Item</th><th>Concentração</th><th>Por kg cem.</th><th>Total</th><th>Unidade</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
  }

  resetForm(): void {
    this.form.patchValue({
      sectionStartMD: 1400, sectionEndMD: 1500, sectionStartTVD: 1400, sectionEndTVD: 1500,
      wellFinalMD: 1500, wellFinalTVD: 1500, holeID: 8.535, pipeOD: 3.500, pipeID: 2.764,
      backSpacerHeight: 100, surfaceTemp: 80.6, geoGradient: 1.50,
      completionWeight: 9.5, mudWeightBack: 9.5, mudWeightFront: 9.5,
      fracGrad: 16.0, poreGrad: 9.0, pumpRate: 3.0, density: 15.8, cementClass: 'G',
      waterSplitFresh: 100, waterSplitSea: 0, silica: 35, nacl: 0,
      theta300: 181, theta200: 132, theta100: 79, theta60: 53, theta30: 31, theta20: 23,
      theta10: 13, theta6: 9, theta3: 6, centralization: 70, flowStability: 1.0,
      surgeFactor: 1.0, freeFallSensitivity: 1.0, roughness: 'medium',
      motorHP: 1000, pumpEff: 90, maxSurfacePressure: 5000, maxPumpRate: 8.0,
    });
    while (this.additivos.length) this.additivos.removeAt(0);
  }
}
