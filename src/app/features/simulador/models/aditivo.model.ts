export type AditivoTipo = 'solid' | 'liquid' | 'gas';
export type AditivoEstadoFisico = AditivoTipo;

export type AditivoCategoria =
  | 'accelerator'
  | 'retarder'
  | 'dispersant'
  | 'fluidLossControl'
  | 'fluid-loss'
  | 'gasMigrationControl'
  | 'weightingAgent'
  | 'extender'
  | 'lightweightAgent'
  | 'viscosifier'
  | 'antifoam'
  | 'salt'
  | 'silica'
  | 'lostCirculationMaterial'
  | 'spacerAdditive'
  | 'washerAdditive'
  | 'other';

export type UnidadeDosagem =
  | 'percentBWOC'
  | 'percentBWOW'
  | 'galPerSack'
  | 'galPerBbl'
  | 'galPerCubicFootCement'
  | 'lbPerSack'
  | 'kgPerM3'
  | 'lbPerBbl';

export type MisturadoEm = 'cimentoSeco' | 'aguaMistura' | 'fluidoBase' | 'adicionadoCampo';
export type MassaEspecificaUnidade = 'sg' | 'lbPerGal' | 'kgPerM3' | 'gPerCm3';
export type EfeitoTendencia = 'increase' | 'decrease' | 'neutral' | 'unknown';
export type EfeitoTempoPega = 'accelerate' | 'retard' | 'neutral' | 'unknown';
export type EfeitoReduzAumenta = 'reduce' | 'increase' | 'neutral' | 'unknown';
export type EfeitoReologicoPrincipal =
  | 'dispersant'
  | 'viscosifier'
  | 'thixotropic'
  | 'frictionReducer'
  | 'yieldPointReducer'
  | 'yieldPointIncreaser'
  | 'plasticViscosityReducer'
  | 'plasticViscosityIncreaser'
  | 'gelStrengthIncreaser'
  | 'gelStrengthReducer'
  | 'neutral'
  | 'unknown';
export type ModeloReologico = 'none' | 'binghamPlastic' | 'powerLaw' | 'herschelBulkley' | 'fannReadings' | 'empirical';

export interface FannReadings {
  rpm300?: number | null;
  rpm200?: number | null;
  rpm100?: number | null;
  rpm60?: number | null;
  rpm30?: number | null;
  rpm6?: number | null;
  rpm3?: number | null;
}

export interface AditivoRheologyCoefficients {
  pvDeltaPerUnit?: number | null;
  ypDeltaPerUnit?: number | null;
  gel10sDeltaPerUnit?: number | null;
  gel10minDeltaPerUnit?: number | null;
  gel30minDeltaPerUnit?: number | null;
  frictionFactorMultiplier?: number | null;
  frictionFactorMultiplierDeltaPerUnit?: number | null;
  consistencyDeltaPerUnit?: number | null;
  thickeningTimeDeltaMinPerUnit?: number | null;
  fluidLossReductionFactorPerUnit?: number | null;
}

export interface Aditivo {
  catalogId?: string;
  id?: string;
  name: string;
  nomeComercial?: string;
  commercialName?: string;
  nomeQuimico?: string;
  category: AditivoCategoria;
  categoria?: AditivoCategoria;
  type: AditivoTipo;
  estadoFisico?: AditivoEstadoFisico;
  conc: number;
  concentracaoPadrao?: number;
  concentracaoUsada?: number;
  concentracaoMin?: number | null;
  concentracaoMax?: number | null;
  unidadeDosagem?: UnidadeDosagem;
  unit?: string;
  misturadoEm?: MisturadoEm;
  descricao?: string;
  description?: string;
  fabricante?: string;
  codigoInterno?: string;
  ativo?: boolean;
  funcaoPrincipal?: string;
  primaryFunction?: string;
  obrigatorioNaPasta?: boolean;

  massaEspecifica?: number | null;
  specificGravity?: number | null;
  massaEspecificaUnidade?: MassaEspecificaUnidade;
  volumeAbsolutoGalPerLb?: number | null;
  absoluteVolumeGalLb?: number | null;
  densidadeLbGal?: number | null;
  densityLbGal?: number | null;
  densityLb?: number | null;
  purezaPercent?: number | null;
  solubilidade?: string;
  temperaturaMaxF?: number | null;
  temperaturaMinF?: number | null;

  alteraDensidade?: EfeitoTendencia;
  alteraTempoPega?: EfeitoTempoPega;
  alteraFiltrado?: EfeitoReduzAumenta;
  alteraAguaLivre?: EfeitoReduzAumenta;
  alteraResistenciaCompressao?: EfeitoTendencia;
  alteraEstabilidade?: EfeitoTendencia;
  alteraSedimentacao?: EfeitoReduzAumenta;
  alteraRiscoGasMigration?: EfeitoReduzAumenta;
  alteraPerdaCirculacao?: 'reduce' | 'neutral' | 'unknown';

  afetaReologia?: boolean;
  efeitoReologicoPrincipal?: EfeitoReologicoPrincipal;
  modeloReologico?: ModeloReologico;
  plasticViscosityCp?: number | null;
  yieldPointLbf100ft2?: number | null;
  gel10sLbf100ft2?: number | null;
  gel10minLbf100ft2?: number | null;
  gel30minLbf100ft2?: number | null;
  consistencyBc?: number | null;
  thickeningTimeMin?: number | null;
  fluidLossCc30min?: number | null;
  freeWaterMl?: number | null;
  rpm300?: number | null;
  rpm200?: number | null;
  rpm100?: number | null;
  rpm60?: number | null;
  rpm30?: number | null;
  rpm6?: number | null;
  rpm3?: number | null;
  temperaturaTesteF?: number | null;
  pressaoTestePsi?: number | null;
  tempoCondicionamentoMin?: number | null;
  concentracaoTeste?: number | null;
  unidadeConcentracaoTeste?: UnidadeDosagem | null;
  coefficients?: AditivoRheologyCoefficients | null;
  rheology?: {
    affectsRheology?: boolean;
    mainEffect?: EfeitoReologicoPrincipal;
    model?: ModeloReologico;
    plasticViscosityCp?: number | null;
    yieldPointLbf100ft2?: number | null;
    gel10sLbf100ft2?: number | null;
    gel10minLbf100ft2?: number | null;
    gel30minLbf100ft2?: number | null;
    fannReadings?: FannReadings | null;
    coefficients?: AditivoRheologyCoefficients | null;
  } | null;

  compativelComAguaDoce?: boolean;
  compativelComAguaMar?: boolean;
  compativelComSalmoura?: boolean;
  compativelComLatex?: boolean;
  compativelComSilica?: boolean;
  compativelComEspumada?: boolean;
  riscoEspuma?: boolean;
  observacoesOperacionais?: string;
  observacoesLaboratorio?: string;
  fonteDados?: string;
  warnings?: string[];
}

export interface AditivoCalc {
  name: string;
  type: AditivoTipo;
  category: AditivoCategoria;
  conc: number;
  dosageUnit?: UnidadeDosagem;
  mixedIn?: MisturadoEm;
  wt: number;    // lb/sk
  vol: number;   // gal/sk
  absoluteVolumeGal?: number;
  warning?: string;
}

export interface AditivoEfeitos {
  retarder: number;
  accelerator: number;
  dispersant: number;
  fluidLoss: number;
  ttShift: number;
  slopeModifier: number;
  t30Extra: number;
  t100Extra: number;
  tempSensTotal: number;
  ucaOnsetMod: number;
  ucaStrengthMod: number;
  freeWaterMod: number;
  warnings?: string[];
}

export interface AditivoCatalogo extends Partial<Aditivo> {
  catalogId: string;
  name: string;
  category: AditivoCategoria;
  type: AditivoTipo;
  defaultConc: number;
  unit: string;
  ttShiftPerUnit?: number;
  slopeModPerUnit?: number;
  ucaOnsetPerUnit?: number;
  ucaStrengthPerUnit?: number;
  freeWaterPerUnit?: number;
}

export const ADITIVO_CATEGORIAS: { value: AditivoCategoria; label: string }[] = [
  { value: 'accelerator', label: 'Acelerador' },
  { value: 'retarder', label: 'Retardador' },
  { value: 'dispersant', label: 'Dispersante' },
  { value: 'fluidLossControl', label: 'Controlador de filtrado' },
  { value: 'gasMigrationControl', label: 'Controlador de gás' },
  { value: 'weightingAgent', label: 'Adensante' },
  { value: 'extender', label: 'Estendedor' },
  { value: 'lightweightAgent', label: 'Material leve' },
  { value: 'viscosifier', label: 'Viscosificante' },
  { value: 'antifoam', label: 'Antiespumante' },
  { value: 'salt', label: 'Sal' },
  { value: 'silica', label: 'Sílica' },
  { value: 'lostCirculationMaterial', label: 'Material de perda' },
  { value: 'spacerAdditive', label: 'Aditivo de colchão' },
  { value: 'washerAdditive', label: 'Aditivo lavador' },
  { value: 'other', label: 'Outro' },
];

export const ADITIVO_UNIDADES_DOSAGEM: { value: UnidadeDosagem; label: string }[] = [
  { value: 'percentBWOC', label: '% BWOC' },
  { value: 'percentBWOW', label: '% BWOW' },
  { value: 'galPerSack', label: 'gal/sk' },
  { value: 'galPerBbl', label: 'gal/bbl' },
  { value: 'galPerCubicFootCement', label: 'gal/ft³ cimento' },
  { value: 'lbPerSack', label: 'lb/sk' },
  { value: 'kgPerM3', label: 'kg/m³' },
  { value: 'lbPerBbl', label: 'lb/bbl' },
];

export const ADITIVO_MISTURADO_EM: { value: MisturadoEm; label: string }[] = [
  { value: 'cimentoSeco', label: 'Cimento seco' },
  { value: 'aguaMistura', label: 'Água de mistura' },
  { value: 'fluidoBase', label: 'Fluido base' },
  { value: 'adicionadoCampo', label: 'Adicionado em campo' },
];

export const ADITIVOS_CATALOGO: AditivoCatalogo[] = [
  {
    catalogId: 'bqrt_40', name: 'BQRT-40', category: 'retarder', type: 'liquid',
    defaultConc: 0.04, unit: 'galPerSack', unidadeDosagem: 'galPerSack', misturadoEm: 'aguaMistura',
    densidadeLbGal: 9.1, densityLb: 9.1, afetaReologia: true, modeloReologico: 'empirical',
    funcaoPrincipal: 'Retardador',
    alteraTempoPega: 'retard',
    coefficients: {
      pvDeltaPerUnit: 60,
      ypDeltaPerUnit: 80,
      gel10sDeltaPerUnit: 30,
      gel10minDeltaPerUnit: 60,
      gel30minDeltaPerUnit: 90,
      consistencyDeltaPerUnit: 20,
      thickeningTimeDeltaMinPerUnit: 1200,
      frictionFactorMultiplierDeltaPerUnit: 1.5,
      fluidLossReductionFactorPerUnit: 0,
    },
  },
  {
    catalogId: 'bqac_50', name: 'BQAC-50', category: 'accelerator', type: 'liquid',
    defaultConc: 0.03, unit: 'galPerSack', unidadeDosagem: 'galPerSack', misturadoEm: 'aguaMistura',
    densidadeLbGal: 9.3, densityLb: 9.3, afetaReologia: true, modeloReologico: 'empirical',
    funcaoPrincipal: 'Acelerador',
    alteraTempoPega: 'accelerate',
    coefficients: {
      pvDeltaPerUnit: -40,
      ypDeltaPerUnit: -50,
      gel10sDeltaPerUnit: -15,
      gel10minDeltaPerUnit: -25,
      gel30minDeltaPerUnit: -35,
      consistencyDeltaPerUnit: -15,
      thickeningTimeDeltaMinPerUnit: -600,
      frictionFactorMultiplierDeltaPerUnit: -0.8,
      fluidLossReductionFactorPerUnit: 0,
    },
  },
  {
    catalogId: 'bqd_20', name: 'BQ-20', category: 'dispersant', type: 'liquid',
    defaultConc: 0.02, unit: 'galPerSack', unidadeDosagem: 'galPerSack', misturadoEm: 'aguaMistura',
    densidadeLbGal: 9.0, densityLb: 9.0, afetaReologia: true, modeloReologico: 'empirical',
    funcaoPrincipal: 'Dispersante',
    efeitoReologicoPrincipal: 'dispersant',
    coefficients: {
      pvDeltaPerUnit: -260,
      ypDeltaPerUnit: -430,
      gel10sDeltaPerUnit: -100,
      gel10minDeltaPerUnit: -180,
      gel30minDeltaPerUnit: -220,
      consistencyDeltaPerUnit: -80,
      thickeningTimeDeltaMinPerUnit: 900,
      frictionFactorMultiplierDeltaPerUnit: -5.0,
      fluidLossReductionFactorPerUnit: 0,
    },
  },
  {
    catalogId: 'bqfl_30', name: 'BQFL-30', category: 'fluidLossControl', type: 'liquid',
    defaultConc: 0.03, unit: 'galPerSack', unidadeDosagem: 'galPerSack', misturadoEm: 'aguaMistura',
    densidadeLbGal: 9.2, densityLb: 9.2, afetaReologia: true, modeloReologico: 'empirical',
    funcaoPrincipal: 'Controlador de filtrado líquido',
    alteraFiltrado: 'reduce',
    coefficients: {
      pvDeltaPerUnit: 140,
      ypDeltaPerUnit: 180,
      gel10sDeltaPerUnit: 80,
      gel10minDeltaPerUnit: 140,
      gel30minDeltaPerUnit: 180,
      consistencyDeltaPerUnit: 60,
      thickeningTimeDeltaMinPerUnit: 500,
      frictionFactorMultiplierDeltaPerUnit: 2.0,
      fluidLossReductionFactorPerUnit: 0.15,
    },
  },
  {
    catalogId: 'fl_34', name: 'FL-34', category: 'fluidLossControl', type: 'solid',
    defaultConc: 3, unit: 'percentBWOC', unidadeDosagem: 'percentBWOC', misturadoEm: 'cimentoSeco',
    massaEspecifica: 1.30, massaEspecificaUnidade: 'sg', volumeAbsolutoGalPerLb: 0.093,
    afetaReologia: true, modeloReologico: 'empirical',
    funcaoPrincipal: 'Controlador de filtrado sólido',
    alteraFiltrado: 'reduce',
    coefficients: {
      pvDeltaPerUnit: 14,
      ypDeltaPerUnit: 18,
      gel10sDeltaPerUnit: 6,
      gel10minDeltaPerUnit: 10,
      gel30minDeltaPerUnit: 13,
      consistencyDeltaPerUnit: 5,
      thickeningTimeDeltaMinPerUnit: 0,
      frictionFactorMultiplierDeltaPerUnit: 0.3,
      fluidLossReductionFactorPerUnit: 0.08,
    },
  },
  {
    catalogId: 'def_1520', name: 'DEF-1520', category: 'antifoam', type: 'liquid',
    defaultConc: 0.02, unit: 'galPerSack', unidadeDosagem: 'galPerSack', misturadoEm: 'aguaMistura',
    densidadeLbGal: 8.5, densityLb: 8.5, concentracaoMin: 0, concentracaoMax: 0.1,
    afetaReologia: true, modeloReologico: 'empirical',
    funcaoPrincipal: 'Antiespumante',
    riscoEspuma: false,
    coefficients: {
      pvDeltaPerUnit: -20,
      ypDeltaPerUnit: -20,
      gel10sDeltaPerUnit: -5,
      gel10minDeltaPerUnit: -8,
      gel30minDeltaPerUnit: -10,
      consistencyDeltaPerUnit: -5,
      thickeningTimeDeltaMinPerUnit: 0,
      frictionFactorMultiplierDeltaPerUnit: -0.2,
      fluidLossReductionFactorPerUnit: 0,
    },
  },
  {
    catalogId: 'sodium-chloride-nacl', name: 'Cloreto de sódio', commercialName: 'NaCl',
    category: 'salt', type: 'solid', defaultConc: 2, unit: 'percentBWOW', unidadeDosagem: 'percentBWOW',
    misturadoEm: 'aguaMistura', concentracaoMin: 0, concentracaoMax: 18,
    volumeAbsolutoGalPerLb: 0.042, afetaReologia: true, modeloReologico: 'empirical',
    funcaoPrincipal: 'Sal compatibilizante',
    coefficients: {
      pvDeltaPerUnit: 3,
      ypDeltaPerUnit: 4,
      gel10sDeltaPerUnit: 1,
      gel10minDeltaPerUnit: 2,
      gel30minDeltaPerUnit: 3,
      consistencyDeltaPerUnit: 1,
      thickeningTimeDeltaMinPerUnit: -30,
      frictionFactorMultiplierDeltaPerUnit: 0.2,
      fluidLossReductionFactorPerUnit: 0,
    },
  },
  {
    catalogId: 'silica-flour', name: 'Sílica', commercialName: 'Silica Flour',
    category: 'silica', type: 'solid', defaultConc: 35, unit: 'percentBWOC', unidadeDosagem: 'percentBWOC',
    misturadoEm: 'cimentoSeco', concentracaoMin: 0, concentracaoMax: 40,
    massaEspecifica: 2.65, massaEspecificaUnidade: 'sg', volumeAbsolutoGalPerLb: 0.0453,
    afetaReologia: true, modeloReologico: 'empirical',
    funcaoPrincipal: 'Alta temperatura e estabilidade',
    coefficients: {
      pvDeltaPerUnit: 0.6,
      ypDeltaPerUnit: 0.8,
      gel10sDeltaPerUnit: 0.2,
      gel10minDeltaPerUnit: 0.4,
      gel30minDeltaPerUnit: 0.6,
      consistencyDeltaPerUnit: 0.3,
      thickeningTimeDeltaMinPerUnit: 0,
      frictionFactorMultiplierDeltaPerUnit: 0.05,
      fluidLossReductionFactorPerUnit: 0,
    },
  },
  {
    catalogId: 'bentonite', name: 'Bentonita', category: 'extender', type: 'solid',
    defaultConc: 2, unit: 'percentBWOC', unidadeDosagem: 'percentBWOC', misturadoEm: 'cimentoSeco',
    concentracaoMin: 0, concentracaoMax: 6, massaEspecifica: 2.65, massaEspecificaUnidade: 'sg',
    afetaReologia: true, modeloReologico: 'empirical',
    funcaoPrincipal: 'Estendedor e viscosificante',
    efeitoReologicoPrincipal: 'viscosifier',
    coefficients: {
      pvDeltaPerUnit: 8,
      ypDeltaPerUnit: 20,
      gel10sDeltaPerUnit: 10,
      gel10minDeltaPerUnit: 18,
      gel30minDeltaPerUnit: 25,
      consistencyDeltaPerUnit: 5,
      thickeningTimeDeltaMinPerUnit: 0,
      frictionFactorMultiplierDeltaPerUnit: 0.5,
      fluidLossReductionFactorPerUnit: 0,
    },
  },
  {
    catalogId: 'antifoam-generic-liquid', name: 'Antiespumante líquido genérico', commercialName: 'Antifoam',
    category: 'antifoam', type: 'liquid', defaultConc: 0.02, unit: 'galPerSack', unidadeDosagem: 'galPerSack',
    misturadoEm: 'aguaMistura', concentracaoMin: 0, concentracaoMax: 0.1,
    afetaReologia: false, modeloReologico: 'none',
    funcaoPrincipal: 'Controlar espuma',
  },
];
