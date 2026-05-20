import { Injectable } from '@angular/core';
import { Aditivo, AditivoRheologyCoefficients, FannReadings } from '../models/aditivo.model';

export interface BaseRheology {
  plasticViscosityCp?: number | null;
  yieldPointLbf100ft2?: number | null;
  gel10sLbf100ft2?: number | null;
  gel10minLbf100ft2?: number | null;
  gel30minLbf100ft2?: number | null;
  consistencyBc?: number | null;
  thickeningTimeMin?: number | null;
  frictionFactorMultiplier?: number | null;
  fluidLossCc30min?: number | null;
  rpm300?: number | null;
  rpm200?: number | null;
  rpm100?: number | null;
  rpm60?: number | null;
  rpm30?: number | null;
  rpm6?: number | null;
  rpm3?: number | null;
}

export interface RheologyAdjustmentResult {
  rheology: BaseRheology;
  warnings: string[];
  confidence: 'manual' | 'measured' | 'estimated' | 'unknown';
  rheologyPressureFactor: number;
  synergyApplied: string[];
  riscoEspuma: boolean;
}

/** Pasta Classe G 15.8 ppg sem aditivos — referência empírica. */
export const BASE_SLURRY_RHEOLOGY: BaseRheology = {
  plasticViscosityCp: 38,
  yieldPointLbf100ft2: 45,
  gel10sLbf100ft2: 10,
  gel10minLbf100ft2: 22,
  gel30minLbf100ft2: 32,
  consistencyBc: 30,
  thickeningTimeMin: null,
  frictionFactorMultiplier: 1.0,
  fluidLossCc30min: 1500,
  rpm300: 75,
  rpm200: 60,
  rpm100: 42,
  rpm60: 32,
  rpm30: 22,
  rpm6: 9,
  rpm3: 7,
};

@Injectable({ providedIn: 'root' })
export class RheologyAdjustmentService {

  applyAdditiveRheologyEffects(baseRheology: BaseRheology, additives: Aditivo[]): RheologyAdjustmentResult {
    const rheology: BaseRheology = { ...BASE_SLURRY_RHEOLOGY, ...this.sanitizeBase(baseRheology) };
    const warnings: string[] = [];
    const synergyApplied: string[] = [];
    let confidence: RheologyAdjustmentResult['confidence'] = 'manual';
    let riscoEspuma = false;

    let frictionDelta = 0;
    let hasDispersant = false;
    let hasFluidLoss = false;
    let hasSilica = false;
    let hasAccelerator = false;
    let hasRetarder = false;
    let hasLatex = false;
    let hasAntifoam = false;

    for (const additive of additives || []) {
      if (!this.affectsRheology(additive)) continue;

      const label = additive.name || additive.nomeComercial || additive.commercialName || 'Aditivo';
      const concentration = this.numberOrZero(additive.concentracaoUsada ?? additive.conc ?? additive.concentracaoPadrao);
      const coeffs = this.getCoefficients(additive);
      const fann = this.getFannReadings(additive);

      if (!this.hasMeasuredRheology(additive) && !this.hasAnyCoefficient(coeffs) && !this.hasAnyFann(fann)) {
        warnings.push(`${label}: pode afetar a reologia, mas sem coeficientes cadastrados — efeito não calculado.`);
        confidence = confidence === 'manual' ? 'unknown' : confidence;
        continue;
      }

      const min = additive.concentracaoMin;
      const max = additive.concentracaoMax;
      if (typeof min === 'number' && concentration < min) warnings.push(`${label}: concentração abaixo do mínimo; resultado é extrapolação.`);
      if (typeof max === 'number' && concentration > max) warnings.push(`${label}: concentração acima do máximo; resultado é extrapolação.`);

      if (this.hasAnyCoefficient(coeffs)) {
        this.applyCoefficient(rheology, 'plasticViscosityCp', coeffs.pvDeltaPerUnit, concentration);
        this.applyCoefficient(rheology, 'yieldPointLbf100ft2', coeffs.ypDeltaPerUnit, concentration);
        this.applyCoefficient(rheology, 'gel10sLbf100ft2', coeffs.gel10sDeltaPerUnit, concentration);
        this.applyCoefficient(rheology, 'gel10minLbf100ft2', coeffs.gel10minDeltaPerUnit, concentration);
        this.applyCoefficient(rheology, 'gel30minLbf100ft2', coeffs.gel30minDeltaPerUnit, concentration);
        this.applyCoefficient(rheology, 'consistencyBc', coeffs.consistencyDeltaPerUnit, concentration);
        this.applyCoefficient(rheology, 'thickeningTimeMin', coeffs.thickeningTimeDeltaMinPerUnit, concentration);
        if (this.isFiniteNumber(coeffs.fluidLossReductionFactorPerUnit) && (coeffs.fluidLossReductionFactorPerUnit as number) > 0) {
          const base = this.numberOrDefault(rheology.fluidLossCc30min, 1500);
          const reduction = Math.min(0.95, (coeffs.fluidLossReductionFactorPerUnit as number) * concentration);
          rheology.fluidLossCc30min = Math.max(20, base * (1 - reduction));
        }
        if (this.isFiniteNumber(coeffs.frictionFactorMultiplierDeltaPerUnit)) {
          frictionDelta += (coeffs.frictionFactorMultiplierDeltaPerUnit as number) * concentration;
        } else if (this.isFiniteNumber(coeffs.frictionFactorMultiplier)) {
          frictionDelta += ((coeffs.frictionFactorMultiplier as number) - 1);
        }
        confidence = 'estimated';
      }

      if (this.hasAnyFann(fann)) {
        Object.assign(rheology, fann);
        const pv = this.calcPvFromFann(fann);
        const yp = this.calcYpFromFann(fann);
        if (pv != null) rheology.plasticViscosityCp = pv;
        if (yp != null) rheology.yieldPointLbf100ft2 = yp;
        warnings.push(`${label}: leituras Fann cadastradas substituíram estimativa base.`);
        confidence = 'measured';
      }

      this.applyMeasuredFields(rheology, additive);

      const cat = additive.category ?? additive.categoria;
      if (cat === 'dispersant') hasDispersant = true;
      if (cat === 'fluidLossControl' || cat === 'fluid-loss') hasFluidLoss = true;
      if (cat === 'silica') hasSilica = true;
      if (cat === 'accelerator') hasAccelerator = true;
      if (cat === 'retarder') hasRetarder = true;
      if (additive.riscoEspuma) hasLatex = true;
      if (cat === 'antifoam') hasAntifoam = true;
    }

    // Regras de sinergia
    if (hasDispersant && hasFluidLoss) {
      rheology.plasticViscosityCp = this.isFiniteNumber(rheology.plasticViscosityCp)
        ? (rheology.plasticViscosityCp as number) * 0.90 : rheology.plasticViscosityCp;
      rheology.yieldPointLbf100ft2 = this.isFiniteNumber(rheology.yieldPointLbf100ft2)
        ? (rheology.yieldPointLbf100ft2 as number) * 0.90 : rheology.yieldPointLbf100ft2;
      synergyApplied.push('Dispersante + Controlador de filtrado: redução adicional de 10% em PV e YP.');
    }
    if (hasSilica && hasAccelerator) {
      rheology.plasticViscosityCp = this.isFiniteNumber(rheology.plasticViscosityCp)
        ? (rheology.plasticViscosityCp as number) * 1.05 : rheology.plasticViscosityCp;
      synergyApplied.push('Sílica + Acelerador em alta temperatura: PV aumentado 5%.');
    }
    if (hasAccelerator && hasRetarder) {
      warnings.push('Acelerador e retardador na mesma pasta — efeito pode ser imprevisível; recomendar teste de laboratório.');
      synergyApplied.push('Acelerador + Retardador: efeito oponente — resultado incerto.');
    }
    if (hasLatex && !hasAntifoam) {
      riscoEspuma = true;
      warnings.push('Latex sem antiespumante: risco de formação de espuma na pasta.');
    }

    // Clamping de valores físicos mínimos
    if (this.isFiniteNumber(rheology.plasticViscosityCp)) rheology.plasticViscosityCp = Math.max(5, rheology.plasticViscosityCp as number);
    if (this.isFiniteNumber(rheology.yieldPointLbf100ft2)) rheology.yieldPointLbf100ft2 = Math.max(2, rheology.yieldPointLbf100ft2 as number);
    if (this.isFiniteNumber(rheology.gel10sLbf100ft2)) rheology.gel10sLbf100ft2 = Math.max(1, rheology.gel10sLbf100ft2 as number);
    if (this.isFiniteNumber(rheology.gel10minLbf100ft2)) rheology.gel10minLbf100ft2 = Math.max(2, rheology.gel10minLbf100ft2 as number);
    if (this.isFiniteNumber(rheology.gel30minLbf100ft2)) rheology.gel30minLbf100ft2 = Math.max(3, rheology.gel30minLbf100ft2 as number);
    if (this.isFiniteNumber(rheology.consistencyBc)) rheology.consistencyBc = Math.max(1, rheology.consistencyBc as number);

    // Fator de pressão hidráulica
    const pv = this.numberOrDefault(rheology.plasticViscosityCp, 38);
    const yp = this.numberOrDefault(rheology.yieldPointLbf100ft2, 45);
    const baseMultiplier = Math.max(0.65, Math.min(1.80, 1 + (pv - 38) / 100 + (yp - 45) / 180));
    const effectiveFrictionDelta = frictionDelta / 100;
    const rheologyPressureFactor = Math.max(0.5, Math.min(2.0, baseMultiplier + effectiveFrictionDelta));

    return {
      rheology: this.sanitize(rheology),
      warnings,
      confidence,
      rheologyPressureFactor,
      synergyApplied,
      riscoEspuma,
    };
  }

  computeRheologyPressureFactor(additives: Aditivo[]): number {
    const result = this.applyAdditiveRheologyEffects({}, additives);
    return result.rheologyPressureFactor;
  }

  hasAutomaticRheologyData(additive: Aditivo): boolean {
    return this.hasMeasuredRheology(additive) || this.hasAnyCoefficient(this.getCoefficients(additive)) || this.hasAnyFann(this.getFannReadings(additive));
  }

  private sanitizeBase(base: BaseRheology): BaseRheology {
    const out: BaseRheology = {};
    for (const [k, v] of Object.entries(base) as [keyof BaseRheology, unknown][]) {
      if (this.isFiniteNumber(v)) (out as Record<string, unknown>)[k] = v;
    }
    return out;
  }

  private affectsRheology(additive: Aditivo): boolean {
    return !!(additive.afetaReologia ?? additive.rheology?.affectsRheology);
  }

  private getCoefficients(additive: Aditivo): AditivoRheologyCoefficients {
    return additive.coefficients || additive.rheology?.coefficients || {};
  }

  private getFannReadings(additive: Aditivo): FannReadings {
    return {
      rpm300: additive.rpm300 ?? additive.rheology?.fannReadings?.rpm300,
      rpm200: additive.rpm200 ?? additive.rheology?.fannReadings?.rpm200,
      rpm100: additive.rpm100 ?? additive.rheology?.fannReadings?.rpm100,
      rpm60: additive.rpm60 ?? additive.rheology?.fannReadings?.rpm60,
      rpm30: additive.rpm30 ?? additive.rheology?.fannReadings?.rpm30,
      rpm6: additive.rpm6 ?? additive.rheology?.fannReadings?.rpm6,
      rpm3: additive.rpm3 ?? additive.rheology?.fannReadings?.rpm3,
    };
  }

  private hasMeasuredRheology(additive: Aditivo): boolean {
    return [
      additive.plasticViscosityCp ?? additive.rheology?.plasticViscosityCp,
      additive.yieldPointLbf100ft2 ?? additive.rheology?.yieldPointLbf100ft2,
      additive.gel10sLbf100ft2 ?? additive.rheology?.gel10sLbf100ft2,
      additive.gel10minLbf100ft2 ?? additive.rheology?.gel10minLbf100ft2,
      additive.gel30minLbf100ft2 ?? additive.rheology?.gel30minLbf100ft2,
    ].some(v => this.isFiniteNumber(v));
  }

  private hasAnyCoefficient(coeffs: AditivoRheologyCoefficients): boolean {
    return Object.values(coeffs || {}).some(v => this.isFiniteNumber(v));
  }

  private hasAnyFann(fann: FannReadings): boolean {
    return Object.values(fann || {}).some(v => this.isFiniteNumber(v));
  }

  private applyCoefficient(target: BaseRheology, key: keyof BaseRheology, delta: number | null | undefined, concentration: number): void {
    if (!this.isFiniteNumber(delta)) return;
    const base = this.numberOrZero(target[key] as number | null | undefined);
    (target as Record<string, unknown>)[key] = Math.max(0, base + (delta as number) * concentration);
  }

  private applyMeasuredFields(target: BaseRheology, additive: Aditivo): void {
    const pairs: [keyof BaseRheology, number | null | undefined][] = [
      ['plasticViscosityCp', additive.plasticViscosityCp ?? additive.rheology?.plasticViscosityCp],
      ['yieldPointLbf100ft2', additive.yieldPointLbf100ft2 ?? additive.rheology?.yieldPointLbf100ft2],
      ['gel10sLbf100ft2', additive.gel10sLbf100ft2 ?? additive.rheology?.gel10sLbf100ft2],
      ['gel10minLbf100ft2', additive.gel10minLbf100ft2 ?? additive.rheology?.gel10minLbf100ft2],
      ['gel30minLbf100ft2', additive.gel30minLbf100ft2 ?? additive.rheology?.gel30minLbf100ft2],
    ];
    for (const [key, value] of pairs) {
      if (this.isFiniteNumber(value)) (target as Record<string, unknown>)[key] = value;
    }
  }

  private calcPvFromFann(fann: FannReadings): number | null {
    if (this.isFiniteNumber(fann.rpm300) && this.isFiniteNumber(fann.rpm100)) return Math.max(0, (fann.rpm300 as number) - (fann.rpm100 as number));
    return null;
  }

  private calcYpFromFann(fann: FannReadings): number | null {
    const pv = this.calcPvFromFann(fann);
    if (pv == null || !this.isFiniteNumber(fann.rpm300)) return null;
    return Math.max(0, (fann.rpm300 as number) - pv);
  }

  private sanitize(rheology: BaseRheology): BaseRheology {
    const clean: BaseRheology = {};
    for (const [key, value] of Object.entries(rheology) as [keyof BaseRheology, number | null | undefined][]) {
      clean[key] = this.isFiniteNumber(value) ? value as number : null;
    }
    return clean;
  }

  private numberOrZero(value: number | null | undefined): number {
    return this.numberOrDefault(value, 0);
  }

  private numberOrDefault(value: number | null | undefined, fallback: number): number {
    return this.isFiniteNumber(value) ? value as number : fallback;
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }
}
