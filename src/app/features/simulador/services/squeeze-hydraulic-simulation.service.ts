import { Injectable } from '@angular/core';
import {
  Perfuracao,
  SqueezeGeometry,
  SqueezeHydraulicPoint,
  SqueezeHydraulicSimulation,
  SqueezeInputs,
} from '../models/squeeze.model';
import { SlurryDesign } from '../models/pasta.model';
import { CoreCalculoService } from './core-calculo.service';
import { Aditivo } from '../models/aditivo.model';
import { RheologyAdjustmentService } from './rheology-adjustment.service';

interface PhaseDef {
  label: string;
  volumeBbl: number;
  densityPpg: number;
  rateBpm: number;
  pauseMin?: number;
}

@Injectable({ providedIn: 'root' })
export class SqueezeHydraulicSimulationService {
  private readonly hydroK = 0.1706;
  readonly categories = [
    'Pressão e deslocamento x tempo',
    'BHP/ECD x tempo',
    'Free fall/tubo em U',
    'Índice operacional por fase',
    'Resumo de volumes/fases',
  ];

  constructor(private core: CoreCalculoService, private rheologyAdj: RheologyAdjustmentService) {}

  simulate(geom: SqueezeGeometry, slurry: SlurryDesign, inputs: SqueezeInputs, perfs: Perfuracao[], additives?: Aditivo[]): SqueezeHydraulicSimulation {
    const rheologyPressureFactor = additives && additives.length > 0
      ? this.rheologyAdj.computeRheologyPressureFactor(additives)
      : 1.0;
    const section = this.core.normalizeSectionValues(
      inputs.sectionStartMD,
      inputs.sectionEndMD,
      inputs.sectionStartTVD,
      inputs.sectionEndTVD,
    );
    const topPerfMD = inputs.topoCanhoneadoMD ?? Math.min(...perfs.map(p => p.top));
    const basePerfMD = inputs.baseCanhoneadoMD ?? Math.max(...perfs.map(p => p.base));
    const topPerfTVD = inputs.topoCanhoneadoTVD ?? section.tvdAt(topPerfMD);
    const basePerfTVD = inputs.baseCanhoneadoTVD ?? section.tvdAt(basePerfMD);
    const referenceMD = inputs.profundidadeReferenciaSqueezeMD ?? (topPerfMD + basePerfMD) / 2;
    const referenceTVD = inputs.profundidadeReferenciaSqueezeTVD ?? (topPerfTVD + basePerfTVD) / 2;
    const surfacePressure = inputs.pressaoSuperficiePsi ?? inputs.surfacePressure ?? 0;
    const poreGrad = inputs.gradientePoroPpg ?? inputs.poreGrad ?? 9;
    const fracGrad = inputs.gradienteFraturaPpg ?? inputs.fracGrad ?? 16;
    const completion = inputs.densidadeFluidoCompletaçãoPpg ?? inputs.completionWeight ?? 9.5;
    const front = inputs.densidadeAguaFrentePpg ?? inputs.mudWeightFront ?? 9.5;
    const back = inputs.densidadeAguaAtrasPpg ?? inputs.mudWeightBack ?? 9.5;
    const cement = inputs.densidadePastaPpg ?? slurry.density ?? 15.8;
    const rate = inputs.vazaoBpm ?? inputs.pumpRate ?? 0;
    const pauseMin = inputs.tempoPausaMin ?? Math.max(0, (inputs as any).pause1 || 0, (inputs as any).pause2 || 0, (inputs as any).pause3 || 0);
    const porePsi = this.hydroK * poreGrad * referenceTVD;
    const fracturePsi = this.hydroK * fracGrad * referenceTVD;
    const phases: PhaseDef[] = [
      { label: 'Água frente', volumeBbl: inputs.volumeAguaFrenteBbl ?? geom.frontPhysicalVolumeBbl, densityPpg: front, rateBpm: rate },
      { label: 'Pasta de cimento', volumeBbl: inputs.volumePastaBbl ?? geom.slurryTotal, densityPpg: cement, rateBpm: rate, pauseMin },
      { label: 'Água atrás', volumeBbl: inputs.volumeAguaAtrasBbl ?? geom.volBackSpacer, densityPpg: back, rateBpm: rate },
      { label: 'Deslocamento', volumeBbl: inputs.volumeDeslocamentoBbl ?? geom.operationalDisplacementVolumeBbl, densityPpg: completion, rateBpm: rate },
      { label: 'Squeeze/pressurização final', volumeBbl: 0, densityPpg: cement, rateBpm: 0, pauseMin: Math.max(1, pauseMin || 2) },
    ];

    const points: SqueezeHydraulicPoint[] = [];
    let timeMin = 0;
    let pumpedVolume = 0;
    let freeFallAccum = 0;
    let lastBhp = 0;
    for (const phase of phases) {
      const pumpDuration = phase.rateBpm > 0 ? phase.volumeBbl / phase.rateBpm : 0;
      const totalDuration = pumpDuration + (phase.pauseMin || 0);
      const steps = Math.max(1, Math.ceil(totalDuration || 1));
      for (let i = 0; i <= steps; i += 1) {
        const elapsed = steps > 0 ? totalDuration * i / steps : 0;
        const pumping = elapsed <= pumpDuration && phase.rateBpm > 0;
        const dt = i === 0 ? 0 : totalDuration / steps;
        const programmedRate = pumping ? phase.rateBpm : 0;
        if (pumping && i > 0) pumpedVolume += programmedRate * dt;
        const hydrostaticPsi = this.segmentedHydrostaticPsi(referenceTVD, completion, front, cement, back, pumpedVolume, geom);
        const annularHydrostaticPsi = this.hydroK * completion * referenceTVD;
        const drivePsi = Math.max(0, hydrostaticPsi - annularHydrostaticPsi);
        const frictionPsi = programmedRate > 0 ? this.calculateFrictionLoss(programmedRate, referenceMD, phase.densityPpg, geom.tubingID_m, rheologyPressureFactor) : 0;
        const naturalRate = this.solveFreeFallRate(drivePsi, programmedRate || rate, referenceMD, phase.densityPpg, geom.tubingID_m, rheologyPressureFactor);
        const realRate = Math.max(programmedRate, naturalRate);
        const freeFallExtraRate = Math.max(0, realRate - programmedRate);
        freeFallAccum += freeFallExtraRate * dt;
        const bhpPsi = surfacePressure + hydrostaticPsi - frictionPsi;
        const ecdPpg = referenceTVD > 0 ? bhpPsi / (this.hydroK * referenceTVD) : null;
        const pumpPressurePsi = Math.max(0, frictionPsi - drivePsi);
        lastBhp = bhpPsi;
        points.push({
          timeMin: timeMin + elapsed,
          phase: phase.label,
          pumpedVolumeBbl: pumpedVolume,
          programmedRateBpm: programmedRate,
          realRateBpm: realRate,
          freeFallExtraRateBpm: freeFallExtraRate,
          pumpPressurePsi,
          surfacePressurePsi: surfacePressure,
          frictionPsi,
          hydrostaticPsi,
          bhpPsi,
          ecdPpg,
          porePsi,
          fracturePsi,
          freeFallAccumBbl: freeFallAccum,
          freeFallHeightM: geom.tubingID_m > 0 ? freeFallAccum / geom.tubingID_m : 0,
          drivePsi,
          hydraulicLossPsi: frictionPsi,
        });
      }
      timeMin += totalDuration;
    }

    const bhps = points.map(p => p.bhpPsi);
    const ecds = points.map(p => p.ecdPpg).filter((v): v is number => v !== null && Number.isFinite(v));
    const bhpMaxPsi = Math.max(...bhps, lastBhp);
    const bhpMinPsi = Math.min(...bhps, lastBhp);
    const pressurePenalty = bhpMaxPsi > fracturePsi || bhpMinPsi < porePsi ? 24 : 0;
    const densityPenalty = cement < back || cement < front ? 12 : 0;
    const ratePenalty = rate < 0.5 || rate > 8 ? 12 : 0;
    const freeFallPenalty = Math.min(18, freeFallAccum * 2);
    const operationalIndex = Math.max(0, Math.round(100 - pressurePenalty - densityPenalty - ratePenalty - freeFallPenalty));
    const alert = bhpMaxPsi > fracturePsi ? 'above-fracture' : bhpMinPsi < porePsi ? 'below-pore' : 'inside-window';

    return {
      categories: this.categories,
      points,
      summary: {
        referenceMD,
        referenceTVD,
        topPerfMD,
        basePerfMD,
        topPerfTVD,
        basePerfTVD,
        porePsi,
        fracturePsi,
        bhpMaxPsi,
        bhpMinPsi,
        ecdMaxPpg: ecds.length ? Math.max(...ecds) : null,
        maxSurfacePressurePsi: surfacePressure,
        marginToFracturePsi: fracturePsi - bhpMaxPsi,
        marginAbovePorePsi: bhpMinPsi - porePsi,
        totalTimeMin: points.at(-1)?.timeMin ?? 0,
        pauseTimeMin: pauseMin,
        freeFallAccumBbl: freeFallAccum,
        freeFallHeightM: geom.tubingID_m > 0 ? freeFallAccum / geom.tubingID_m : 0,
        operationalIndex,
        alert,
      },
    };
  }

  private segmentedHydrostaticPsi(
    tvdRef: number,
    completion: number,
    front: number,
    cement: number,
    back: number,
    pumpedVolume: number,
    geom: SqueezeGeometry,
  ): number {
    const cap = geom.tubingID_m || 0.03;
    const cementHeight = Math.min(tvdRef, (geom.slurryTotal || 0) / cap);
    const frontHeight = Math.min(Math.max(0, tvdRef - cementHeight), (geom.frontPhysicalVolumeBbl || 0) / cap);
    const backHeight = Math.min(Math.max(0, tvdRef - cementHeight - frontHeight), (geom.volBackSpacer || 0) / cap);
    const displacementHeight = Math.min(Math.max(0, pumpedVolume / cap), Math.max(0, tvdRef - cementHeight - frontHeight - backHeight));
    const completionHeight = Math.max(0, tvdRef - cementHeight - frontHeight - backHeight - displacementHeight);
    return this.hydroK * (
      cement * cementHeight +
      front * frontHeight +
      back * backHeight +
      completion * (completionHeight + displacementHeight)
    );
  }

  private calculateFrictionLoss(flowRateBpm: number, lengthMD: number, densityPpg: number, capacityBblM: number, rheologyFactor = 1.0): number {
    if (!Number.isFinite(flowRateBpm) || flowRateBpm <= 0) return 0;
    const hydraulicScale = Math.max(0.012, capacityBblM || 0.03);
    const baseLoss = Math.max(0, 0.012 * lengthMD * densityPpg * (flowRateBpm ** 1.85) / (hydraulicScale * 100));
    return baseLoss * Math.max(0.5, rheologyFactor);
  }

  private solveFreeFallRate(drivePsi: number, pumpRateBpm: number, lengthMD: number, densityPpg: number, capacityBblM: number, rheologyFactor = 1.0): number {
    if (!Number.isFinite(drivePsi) || drivePsi <= 0) return 0;
    const referenceRate = Math.max(0.25, pumpRateBpm || 1);
    const lossAtReference = this.calculateFrictionLoss(referenceRate, lengthMD, densityPpg, capacityBblM, rheologyFactor);
    if (!Number.isFinite(lossAtReference) || lossAtReference <= 1e-6) return 0;
    const q = referenceRate * Math.sqrt(drivePsi / lossAtReference);
    const limited = Math.min(q, referenceRate * 3.5);
    return Number.isFinite(limited) ? Math.max(0, limited) : 0;
  }
}
