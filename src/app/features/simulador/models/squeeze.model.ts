export interface Perfuracao {
  top: number;
  base: number;
}

export interface SqueezeInputs {
  sectionStartMD: number;
  sectionEndMD: number;
  sectionStartTVD: number;
  sectionEndTVD: number;
  wellFinalMD: number;
  wellFinalTVD: number;
  caliper: number;
  casingOD: number;
  casingID: number;
  tubingOD: number;
  tubingID: number;
  backSpacerHeight: number;
  mudWeightFront: number;
  mudWeightBack: number;
  completionWeight: number;
  fracGrad: number;
  poreGrad: number;
  pumpRate: number;
  surfaceTemp: number;
  geoGradient: number;
  surfacePressure: number;
  squeezeTestPressure: number;
  expectedLoss: number;
  topoCanhoneadoMD?: number;
  baseCanhoneadoMD?: number;
  topoCanhoneadoTVD?: number;
  baseCanhoneadoTVD?: number;
  profundidadeReferenciaSqueezeMD?: number;
  profundidadeReferenciaSqueezeTVD?: number;
  pressaoSuperficiePsi?: number;
  gradientePoroPpg?: number;
  gradienteFraturaPpg?: number;
  densidadeFluidoCompletaçãoPpg?: number;
  densidadeAguaFrentePpg?: number;
  densidadeAguaAtrasPpg?: number;
  densidadePastaPpg?: number;
  volumePastaBbl?: number;
  volumeAguaFrenteBbl?: number;
  volumeAguaAtrasBbl?: number;
  volumeDeslocamentoBbl?: number;
  vazaoBpm?: number;
  tempoPausaMin?: number;
  modoOperacao?: 'squeeze';
}

export interface SqueezeGeometry {
  top: number;
  base: number;
  wellFinalMD: number;
  wellFinalTVD: number;
  len: number;
  perfs: Perfuracao[];
  deepestPerf: number;
  shallowestPerf: number;
  annulusOpen_m: number;
  annulusCasing_m: number;
  casingFull_m: number;
  finalCapacity_m: number;
  tubingID_m: number;
  annulusVolume: number;
  workVolumeBbl: number;
  cementHeightWithTubing: number;
  cementHeightWithoutTubing: number;
  displacementVolume: number;
  expectedLoss: number;
  slurryTotal: number;
  slurryPumpedVolumeBbl: number;
  slurryInjectedVolumeBbl: number;
  slurryPhysicalVolumeBbl: number;
  cementPhysicalHeight: number;
  cementPhysicalTopMD: number;
  cementPhysicalBaseMD: number;
  cementPhysicalCapacityBblM: number;
  washVolFront: number;
  washFrontHeight: number;
  frontOperationalHeight: number;
  backOperationalHeight: number;
  frontPhysicalVolumeBbl: number;
  frontPhysicalHeight: number;
  volBackSpacer: number;
  backPhysicalVolumeBbl: number;
  backPhysicalHeight: number;
  displacementHydroBalance: null;
  operationalDisplacementVolumeBbl: number;
  oh: number;
  cOD: number;
  cID: number;
  tOD: number;
  tID: number;
}

export interface SqueezeHydraulicPoint {
  timeMin: number;
  phase: string;
  pumpedVolumeBbl: number;
  programmedRateBpm: number;
  realRateBpm: number;
  freeFallExtraRateBpm: number;
  pumpPressurePsi: number;
  surfacePressurePsi: number;
  frictionPsi: number;
  hydrostaticPsi: number;
  bhpPsi: number;
  ecdPpg: number | null;
  porePsi: number;
  fracturePsi: number;
  freeFallAccumBbl: number;
  freeFallHeightM: number;
  drivePsi: number;
  hydraulicLossPsi: number;
}

export interface SqueezeHydraulicSummary {
  referenceMD: number;
  referenceTVD: number;
  topPerfMD: number;
  basePerfMD: number;
  topPerfTVD: number;
  basePerfTVD: number;
  porePsi: number;
  fracturePsi: number;
  bhpMaxPsi: number;
  bhpMinPsi: number;
  ecdMaxPpg: number | null;
  maxSurfacePressurePsi: number;
  marginToFracturePsi: number;
  marginAbovePorePsi: number;
  totalTimeMin: number;
  pauseTimeMin: number;
  freeFallAccumBbl: number;
  freeFallHeightM: number;
  operationalIndex: number;
  alert: 'below-pore' | 'above-fracture' | 'inside-window';
}

export interface SqueezeHydraulicSimulation {
  summary: SqueezeHydraulicSummary;
  points: SqueezeHydraulicPoint[];
  categories: string[];
}
