import { Injectable } from '@angular/core';
import { CoreCalculoService } from './core-calculo.service';
import { BBL_M, BBL_PER_M, HYDRO_M } from '../models/constantes';
import { SqueezeInputs, SqueezeGeometry, Perfuracao } from '../models/squeeze.model';
import { SlurryDesign } from '../models/pasta.model';

@Injectable({ providedIn: 'root' })
export class SqueezeCalculoService {

  constructor(private core: CoreCalculoService) {}

  calcVolumes(inputs: SqueezeInputs, perfs: Perfuracao[], slurryVolumeOverrideBbl?: number | null): SqueezeGeometry {
    const top = Math.min(inputs.sectionStartMD, inputs.sectionEndMD);
    const base = Math.max(inputs.sectionStartMD, inputs.sectionEndMD);
    const len = Math.max(0, base - top);
    const section = this.core.normalizeSectionValues(inputs.sectionStartMD, inputs.sectionEndMD, inputs.sectionStartTVD, inputs.sectionEndTVD);
    const wellFinal = this.core.getWellFinalGeometry(section, inputs.wellFinalMD, inputs.wellFinalTVD);

    const normalizedPerfs: Perfuracao[] = (perfs || [{ top: top + 20, base: top + 40 }]).map(p => ({
      top: this.core.clamp(Math.min(p.top, p.base), top, base),
      base: this.core.clamp(Math.max(p.top, p.base), top, base),
    }));

    const deepestPerf = normalizedPerfs.reduce((d, p) => Math.max(d, p.base), top);
    const shallowestPerf = normalizedPerfs.reduce((d, p) => Math.min(d, p.top), base);

    const oh = inputs.caliper || 8.5;
    const cOD = inputs.casingOD || 5.5;
    const cID = inputs.casingID || 4.778;
    const tOD = inputs.tubingOD || 2.875;
    const tID = inputs.tubingID || 2.441;

    const annulusOpen_m = BBL_PER_M * Math.max(0, oh * oh - cOD * cOD);
    const annulusCasing_m = BBL_PER_M * Math.max(0, cID * cID - tOD * tOD);
    const casingFull_m = BBL_PER_M * Math.max(0, cID * cID);
    const tubingID_m = BBL_PER_M * Math.max(0, tID * tID);

    const finalCapacity_m = casingFull_m > 0 ? casingFull_m : annulusCasing_m;
    const annulusVolume = finalCapacity_m * len;
    const expectedLoss = Math.max(0, inputs.expectedLoss || 0);
    // Volume total de pasta (bombeado). Quando o usuário escolhe "Receita por Volume",
    // o valor informado substitui o volume geométrico e a geometria é recalculada a partir dele.
    const geometricSlurryTotal = annulusVolume + expectedLoss;
    const slurryTotal = (slurryVolumeOverrideBbl != null && slurryVolumeOverrideBbl > 0)
      ? slurryVolumeOverrideBbl
      : geometricSlurryTotal;
    // Volume físico = volume que ocupa o poço (total menos a perda esperada para a formação)
    const slurryPhysicalVolume = Math.max(0, slurryTotal - expectedLoss);
    const cementPhysicalHeight = finalCapacity_m > 0 ? slurryPhysicalVolume / finalCapacity_m : 0;
    const workVolumeBbl = slurryPhysicalVolume;
    const capWithTubing = annulusCasing_m + tubingID_m;
    const cementHeightWithTubing = capWithTubing > 0 ? slurryPhysicalVolume / capWithTubing : 0;

    const displacementVolume = tubingID_m * deepestPerf;
    const mwFront = Math.max(0, inputs.mudWeightFront || 9.5);
    const mwBack = Math.max(0, inputs.mudWeightBack || 9.5);
    const backPhysicalHeight = Math.max(0, inputs.backSpacerHeight || 0);
    const frontPhysicalHeight = mwFront > 0 ? backPhysicalHeight * (mwBack / mwFront) : backPhysicalHeight;
    const frontPhysicalVolumeBbl = annulusCasing_m * frontPhysicalHeight;
    const backPhysicalVolumeBbl = tubingID_m * backPhysicalHeight;

    return {
      top, base,
      wellFinalMD: wellFinal.wellFinalMD,
      wellFinalTVD: wellFinal.wellFinalTVD,
      len,
      perfs: normalizedPerfs,
      deepestPerf,
      shallowestPerf,
      annulusOpen_m, annulusCasing_m, casingFull_m, finalCapacity_m, tubingID_m,
      annulusVolume, workVolumeBbl,
      cementHeightWithTubing,
      cementHeightWithoutTubing: cementPhysicalHeight,
      displacementVolume,
      expectedLoss, slurryTotal,
      slurryPumpedVolumeBbl: slurryTotal,
      slurryInjectedVolumeBbl: expectedLoss,
      slurryPhysicalVolumeBbl: slurryPhysicalVolume,
      cementPhysicalHeight,
      cementPhysicalTopMD: top,
      cementPhysicalBaseMD: top + cementPhysicalHeight,
      cementPhysicalCapacityBblM: finalCapacity_m,
      washVolFront: frontPhysicalVolumeBbl,
      washFrontHeight: frontPhysicalHeight,
      frontOperationalHeight: frontPhysicalHeight,
      backOperationalHeight: backPhysicalHeight,
      frontPhysicalVolumeBbl, frontPhysicalHeight,
      volBackSpacer: backPhysicalVolumeBbl,
      backPhysicalVolumeBbl, backPhysicalHeight,
      displacementHydroBalance: null,
      operationalDisplacementVolumeBbl: displacementVolume,
      oh, cOD, cID, tOD, tID,
    };
  }

  calcFractureGradient(geom: SqueezeGeometry, inputs: SqueezeInputs): { fracPsi: number; porePsi: number; squeezePsi: number } {
    const K = HYDRO_M;
    const deepTVD = this.core.normalizeSectionValues(inputs.sectionStartMD, inputs.sectionEndMD, inputs.sectionStartTVD, inputs.sectionEndTVD).tvdAt(geom.deepestPerf);
    const fracPsi = K * (inputs.fracGrad || 16.0) * deepTVD + (inputs.surfacePressure || 0);
    const porePsi = K * (inputs.poreGrad || 9.0) * deepTVD;
    const squeezePsi = (inputs.squeezeTestPressure || 400) + (inputs.surfacePressure || 0);
    return { fracPsi, porePsi, squeezePsi };
  }
}
