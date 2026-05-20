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
import { RelatorioViewerComponent } from '../../components/relatorio/relatorio-viewer.component';
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

import { SqueezeGeometry, Perfuracao, SqueezeHydraulicSimulation } from '../../models/squeeze.model';
import { SlurryDesign, SlurryRecipe, Diagnostic, SlurryRecipeByVolume } from '../../models/pasta.model';
import { ThickeningResult, UCAResult } from '../../models/reologia.model';
import { ADITIVOS_CATALOGO, AditivoCatalogo, Aditivo } from '../../models/aditivo.model';
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
  tt: ThickeningResult | null = null;
  uca: UCAResult | null = null;
  rheoDiags: Diagnostic[] = [];
  recipeDiags: Diagnostic[] = [];
  fracResult: { fracPsi: number; porePsi: number; squeezePsi: number } | null = null;
  hydraulicSim: SqueezeHydraulicSimulation | null = null;
  rheologyResult: RheologyAdjustmentResult | null = null;
  freeWater = 0;
  geoFormula = '';
  opsPhases: OpsPhase[] = [];

  relatorioVisivel = false;
  relatorioTitulo = '';
  relatorioConteudo = '';
  aditivosModalOpen = false;
  stateModalOpen = false;

  @ViewChild('stateModal') stateModal!: SimuladorStateModalComponent;

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
    private squeezeHydraulics: SqueezeHydraulicSimulationService,
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
    const v = this.form.getRawValue();
    const perfs: Perfuracao[] = (v.perforacoes || []).map((p: any) => ({ top: +p.top, base: +p.base }));

    const bht = this.coreCalc.calcBHT(v.surfaceTemp, v.geoGradient, v.sectionEndTVD);
    this.form.patchValue({ bhst: bht.bhst, bhct: bht.bhct }, { emitEvent: false });
    this.geoFormula = bht.formula;

    const vWithBHT = { ...v, bhct: bht.bhct, bhst: bht.bhst };

    this.geom = this.squeezeCalc.calcVolumes(v, perfs);
    this.slurry = this.slurryCalc.calculateSlurryDesign(vWithBHT as any);
    this.recipe = this.slurryCalc.buildSlurryRecipe(this.geom.slurryTotal, this.slurry);
    this.manualRecipeResult = this.slurryCalc.buildSlurryRecipe(this.manualVolumeBbl, this.slurry).volumeRecipe ?? null;

    this.tt = this.testsCalc.simulateThickening(this.slurry, v.sectionEndTVD);
    this.uca = this.testsCalc.simulateUCA(this.slurry, this.tt);
    this.freeWater = this.testsCalc.estimateFreeWater(this.slurry);
    this.rheoDiags = this.testsCalc.rheoDiagnostics(this.slurry, this.tt, this.freeWater);
    this.fracResult = this.squeezeCalc.calcFractureGradient(this.geom, v);

    const aditivosRaw: Aditivo[] = (v.additivos || []).map((a: any) => {
      const cat = ADITIVOS_CATALOGO.find(c => c.catalogId === a.catalogId);
      const coefficients = cat?.coefficients ?? (typeof a.coefficients === 'object' ? a.coefficients : null);
      return { ...cat, ...a, conc: +a.conc, coefficients } as Aditivo;
    });
    this.rheologyResult = this.rheologyAdj.applyAdditiveRheologyEffects(BASE_SLURRY_RHEOLOGY, aditivosRaw);
    this.hydraulicSim = this.squeezeHydraulics.simulate(this.geom, this.slurry, v, perfs, aditivosRaw);

    this.buildOpsPhases();
    this.buildRecipeDiags();
  }

  private buildOpsPhases(): void {
    if (!this.geom || !this.tt) return;
    const v = this.form.getRawValue();
    const rate = v.pumpRate || 2;
    const bbl2min = (vol: number) => rate > 0 ? vol / rate * 60 : 0;
    this.opsPhases = [
      { label: 'Fl. Frente', durationMin: bbl2min(this.geom.frontPhysicalVolumeBbl) + (v.pause1 || 0), color: '#bae6fd' },
      { label: 'Pasta', durationMin: bbl2min(this.geom.slurryTotal) + (v.pause2 || 0), color: '#bbf7d0' },
      { label: 'Fl. Atrás', durationMin: bbl2min(this.geom.volBackSpacer) + (v.pause3 || 0), color: '#e9d5ff' },
      { label: 'Deslocamento', durationMin: bbl2min(this.geom.operationalDisplacementVolumeBbl), color: '#fed7aa' },
    ];
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
    this.stateModal?.setCurrentForm(this.form.getRawValue());
    this.stateModalOpen = true;
  }

  closeStateModal(): void { this.stateModalOpen = false; }

  onCarregarEstado(formValue: Record<string, unknown>): void {
    const { additivos, perforacoes, ...rest } = formValue as any;
    this.form.patchValue(rest, { emitEvent: false });
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
    const coefficients = cat?.coefficients ?? data.coefficients ?? {};
    return this.fb.group({
      catalogId: [data.catalogId ?? ''],
      name: [data.name ?? '', Validators.required],
      category: [data.category ?? 'retarder', Validators.required],
      type: [data.type ?? 'liquid', Validators.required],
      conc: [data.conc ?? data.defaultConc ?? 0, [Validators.required, Validators.min(0)]],
      coefficients: [coefficients],
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
    return ad?.get('type')?.value === 'solid' ? '% BWOC' : 'gpc';
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

  fmtTime(h: number): string {
    if (!Number.isFinite(h)) return '-';
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${hh}h ${mm.toString().padStart(2, '0')}min`;
  }

  abrirRelatorioReceita(): void {
    if (!this.geom || !this.slurry || !this.recipe) return;
    const rows = this.recipe.recipeItems
      .map(i => `<tr><td>${i.name}</td><td>${i.conc}</td><td>${this.fmt(i.per, 4)}</td><td>${this.fmt(i.total, 2)}</td><td>${i.unit}</td></tr>`)
      .join('');
    this.relatorioConteudo = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Receita Squeeze</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;font-size:13px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f1f5f9}h2{color:#1e293b}</style></head>
    <body><h2>Squeeze — Cálculo da Receita</h2>
    <p><b>Volume total de pasta:</b> ${this.fmt(this.geom.slurryTotal)} bbl | <b>Sacos:</b> ${this.recipe.sacks} sk | <b>Densidade:</b> ${this.fmt(this.slurry.density)} ppg</p>
    <table><thead><tr><th>Item</th><th>Concentração</th><th>Por kg cem.</th><th>Total</th><th>Unidade</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
    this.relatorioTitulo = 'Cálculo da Receita — Squeeze';
    this.relatorioVisivel = true;
  }

  resetForm(): void {
    this.form.patchValue({
      sectionStartMD: 1400, sectionEndMD: 1500, sectionStartTVD: 1400, sectionEndTVD: 1500,
      wellFinalMD: 1500, wellFinalTVD: 1500,
      caliper: 8.535, casingOD: 5.500, casingID: 4.778, tubingOD: 2.875, tubingID: 2.441,
      backSpacerHeight: 50, surfaceTemp: 80.6, geoGradient: 1.50,
      mudWeightFront: 9.5, mudWeightBack: 9.5, completionWeight: 9.5,
      fracGrad: 16.0, poreGrad: 9.0, pumpRate: 2.0,
      surfacePressure: 0, squeezeTestPressure: 400, expectedLoss: 0,
      density: 15.8, cementClass: 'G', waterSplitFresh: 100, waterSplitSea: 0,
      silica: 35, nacl: 0,
      theta300: 181, theta200: 132, theta100: 79, theta60: 53, theta30: 31, theta20: 23,
      theta10: 13, theta6: 9, theta3: 6,
    });
    while (this.additivos.length) this.additivos.removeAt(0);
    while (this.perforacoes.length > 1) this.perforacoes.removeAt(this.perforacoes.length - 1);
    this.perforacoes.at(0).patchValue({ top: 1420, base: 1440 });
  }
}
