import { Injectable } from '@angular/core';
import { CoreCalculoService } from './core-calculo.service';
import { BBL_M, HYDRO_M } from '../models/constantes';
import { TampaoInputs, PlugGeometry, PressureProfile, PressurePoint, BalanceResult } from '../models/tampao.model';
import { SlurryDesign } from '../models/pasta.model';

@Injectable({ providedIn: 'root' })
export class TampaoCalculoService {

  constructor(private core: CoreCalculoService) {}

  calcPlug(inputs: TampaoInputs, cementVolumeOverrideBbl?: number | null): PlugGeometry {
    const hID = inputs.holeID || 8.535;
    const pOD = inputs.pipeOD || 3.5;
    const pID = inputs.pipeID || 2.764;

    const section = this.core.normalizeSectionValues(
      inputs.sectionStartMD, inputs.sectionEndMD,
      inputs.sectionStartTVD, inputs.sectionEndTVD
    );
    const wellFinal = this.core.getWellFinalGeometry(section, inputs.wellFinalMD, inputs.wellFinalTVD);

    // pTop = topo da seção, pBase = base da seção (base do tampão)
    const pTop = section.startMD;
    const pBase = section.endMD;
    const sEnd = wellFinal.wellFinalMD;

    // Capacidades (bbl/m)
    const capAnn  = BBL_M * Math.max(0, hID * hID - pOD * pOD);  // anular com tubing
    const capPipe = BBL_M * Math.max(0, pID * pID);               // interior do tubing
    const capHole = BBL_M * Math.max(0, hID * hID);               // poço aberto (sem tubing)
    const capWithPipe = capAnn + capPipe;

    // Altura da seção (zona de trabalho)
    const plugHeight = Math.max(0, pBase - pTop);

    // Volume total de pasta = capacidade do poço aberto × altura da seção
    // (é o volume que precisa ser preenchido sem tubing)
    const geometricVolCementTotal = capHole * plugHeight;
    // Quando o usuário escolhe "Receita por Volume", o volume informado substitui
    // o volume geométrico e toda a geometria (alturas/topos) é recalculada a partir dele.
    const volCementTotal = (cementVolumeOverrideBbl != null && cementVolumeOverrideBbl > 0)
      ? cementVolumeOverrideBbl
      : geometricVolCementTotal;

    // ── Estado 1: Com tubing ──
    // Htci = Vp / (Can + Ctp)
    const cementHeightWithTubing = capWithPipe > 0 ? volCementTotal / capWithPipe : 0;
    // topoCimentoComTubing = base - Htci
    const topCementWithTubing = pBase - cementHeightWithTubing;
    const volCementAnn  = capAnn  * cementHeightWithTubing;
    const volCementPipe = capPipe * cementHeightWithTubing;

    // Água atrás: altura definida pelo usuário, no interior do tubing
    const mwBack  = Math.max(0, inputs.mudWeightBack  || 9.5);
    const mwFront = Math.max(0, inputs.mudWeightFront || 9.5);
    const backPhysicalHeight  = Math.max(0, inputs.backSpacerHeight || 0);
    // topoAguaAtras = topoCimentoComTubing - Hfa
    const topBackSpacer = topCementWithTubing - backPhysicalHeight;
    const backPhysicalVolumeBbl = capPipe * backPhysicalHeight;

    // Água frente: altura balanceada hidraulicamente, no anular
    // Hff = (pesoAtrás / pesoFrente) * Hfa
    const frontPhysicalHeight = mwFront > 0 ? backPhysicalHeight * (mwBack / mwFront) : backPhysicalHeight;
    // topoAguaFrente = topoCimentoComTubing - Hff
    const topFrontSpacer = topCementWithTubing - frontPhysicalHeight;
    const frontPhysicalVolumeBbl = capAnn * frontPhysicalHeight;

    // Fluido de deslocamento dentro do tubing: de 0 até topoAguaAtras
    const volDisplacement = capPipe * Math.max(0, topBackSpacer);

    // ── Estado 2: Sem tubing ──
    // Hfinal = Vp / capHole
    const cementHeightWithoutTubing = capHole > 0 ? volCementTotal / capHole : plugHeight;
    // topoCimentoFinal = base - Hfinal
    const topCementWithoutTubing = pBase - cementHeightWithoutTubing;

    // Água frente final no estado sem tubing (no poço aberto)
    const frontHeightNoTubing = frontPhysicalHeight; // mesma altura calculada acima
    const topFrontNoTubing = topCementWithoutTubing - frontHeightNoTubing;

    return {
      hID, pOD, pID, pTop, pBase,
      pipeDep: pBase,
      sEnd,
      spH: backPhysicalHeight,
      wellFinalMD: wellFinal.wellFinalMD,
      wellFinalTVD: wellFinal.wellFinalTVD,
      capAnn, capPipe, capHole, capFinal: capHole,
      plugHeight, lenAnnCement: cementHeightWithTubing,
      volCementAnn, volCementPipe, volCementTotal,
      workVolumeBbl: volCementTotal,
      cementHeightWithTubing,
      cementHeightWithoutTubing,
      // topos calculados corretamente
      topCementWithTubing,
      topCementWithoutTubing,
      topBackSpacer,
      topFrontSpacer,
      topFrontNoTubing,
      volWashAnn: frontPhysicalVolumeBbl,
      volWashTotal: frontPhysicalVolumeBbl,
      volBackSpacer: backPhysicalVolumeBbl,
      volDisplacement,
      frontOperationalHeight: frontPhysicalHeight,
      backOperationalHeight: backPhysicalHeight,
      frontPhysicalVolumeBbl, frontPhysicalHeight,
      cementPhysicalVolumeBbl: volCementTotal,
      cementPhysicalCapacityBblM: capHole,
      cementPhysicalHeight: cementHeightWithoutTubing,
      backPhysicalVolumeBbl, backPhysicalHeight,
      // compat legados
      topCementInPipe: topCementWithTubing,
      topWashInPipe: topBackSpacer,
      displacementHydroBalance: null,
      operationalDisplacementVolumeBbl: volDisplacement,
    };
  }

  calcBalance(plug: PlugGeometry, inputs: TampaoInputs): BalanceResult {
    const mwFront = inputs.mudWeightFront || 9.5;
    const mwBack = inputs.mudWeightBack || 9.5;
    const mwComp = inputs.completionWeight || 9.5;
    const K = HYDRO_M;

    const insidePsi = K * mwComp * plug.topWashInPipe + K * mwBack * plug.backPhysicalHeight + K * (plug.slurryDensity ?? 15.8) * plug.cementHeightWithTubing;
    const outsidePsi = K * mwComp * plug.topWashInPipe + K * mwFront * plug.frontPhysicalHeight + K * (plug.slurryDensity ?? 15.8) * plug.cementHeightWithTubing;
    const deltaPsi = Math.abs(insidePsi - outsidePsi);
    const tol = inputs.hydroBalanceTolerancePsi ?? 10;
    const balanced = deltaPsi <= tol;
    const state = balanced ? 'Balanceado' : deltaPsi <= tol * 3 ? 'Próximo do balanceamento' : 'Desequilibrado';

    return { balanced, deltaPsi, insidePsi, outsidePsi, state };
  }

  calcPressureProfile(plug: PlugGeometry, slurry: SlurryDesign, inputs: TampaoInputs): PressureProfile {
    const fracGrad = inputs.fracGrad || 16.0;
    const poreGrad = inputs.poreGrad || 9.0;
    const K = HYDRO_M;
    const mwComp = inputs.completionWeight || 9.5;
    const mwFront = inputs.mudWeightFront || 9.5;
    const mwBack = inputs.mudWeightBack || 9.5;
    const cementDen = slurry.density || 15.8;
    const section = this.core.normalizeSectionValues(
      inputs.sectionStartMD, inputs.sectionEndMD,
      inputs.sectionStartTVD, inputs.sectionEndTVD,
    );

    // pontos de profundidade relevantes para o perfil de pressão
    const totalTVD = Math.max(plug.pBase, inputs.sectionEndTVD || plug.pBase);
    // topo do cimento no anular = base do tampão - altura com tubing
    const topCemAnn = Math.max(0, plug.pTop - plug.cementHeightWithTubing);
    // topo do fluido à frente = topo do cimento - altura do fluido frente
    const topFront = Math.max(0, topCemAnn - plug.frontPhysicalHeight);

    const points: PressurePoint[] = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const tvd = totalTVD * i / steps;
      const fracPsi = K * fracGrad * tvd;
      const porePsi = K * poreGrad * tvd;

      // BHP coluna (dentro do tubing): deslocamento até topo cimento, depois pasta
      const psiInside = K * mwComp * tvd;

      // BHP anular: fl.frente → pasta → fl.atrás por camadas
      let bhpAnn: number;
      if (tvd <= topFront) {
        bhpAnn = K * mwComp * tvd;
      } else if (tvd <= topCemAnn) {
        bhpAnn = K * mwComp * topFront + K * mwFront * (tvd - topFront);
      } else if (tvd <= plug.pBase) {
        bhpAnn = K * mwComp * topFront + K * mwFront * (topCemAnn - topFront) + K * cementDen * (tvd - topCemAnn);
      } else {
        bhpAnn = K * mwComp * topFront + K * mwFront * (topCemAnn - topFront) + K * cementDen * (plug.pBase - topCemAnn) + K * mwBack * (tvd - plug.pBase);
      }

      const ecdPpg = tvd > 0 ? bhpAnn / (K * tvd) : mwFront;
      // Free fall: propensão da coluna de cimento cair antes do puxamento (zona de cimento)
      const inCementZone = tvd >= topCemAnn && tvd <= plug.pBase;
      const freeFallPct = inCementZone ? Math.max(0, Math.min(100, ((cementDen - mwBack) / cementDen) * 100)) : 0;

      const md = tvd; // simplificado — seção vertical
      points.push({
        md, tvd, psiInside, psiOutside: bhpAnn, fracPsi, porePsi,
        ecdInside: tvd > 0 ? psiInside / (K * tvd) : mwComp,
        ecdOutside: ecdPpg,
        bhpAnn, ecdPpg, freeFallPct,
      });
    }

    return { points, fracGradPpg: fracGrad, poreGradPpg: poreGrad };
  }

  calcOperationalSummary(plug: PlugGeometry, slurry: SlurryDesign, inputs: TampaoInputs, sacks: number, tt50: number): {
    pumpTime: number; ttRequired: number; hhp: number; hhpAvailable: number; hhpUsePct: number; pressureUsePct: number; rateUsePct: number;
  } {
    const pumpRate = inputs.pumpRate || 3.0;
    const totalVol = plug.volWashTotal + plug.volCementTotal + plug.volBackSpacer + plug.volDisplacement;
    const pumpTime = pumpRate > 0 ? totalVol / pumpRate / 60 : 0;
    const ttRequired = tt50;
    const hhp = (5000 * pumpRate) / 40.8;
    const motorHP = 1000;
    const pumpEff = 90 / 100;
    const maxSurfacePressure = 5000;
    const maxPumpRate = 8.0;
    const hhpAvailable = motorHP * pumpEff;
    return {
      pumpTime,
      ttRequired,
      hhp,
      hhpAvailable,
      hhpUsePct: hhpAvailable > 0 ? (hhp / hhpAvailable) * 100 : 0,
      pressureUsePct: maxSurfacePressure > 0 ? (5000 / maxSurfacePressure) * 100 : 0,
      rateUsePct: maxPumpRate > 0 ? (pumpRate / maxPumpRate) * 100 : 0,
    };
  }
}

// Extend PlugGeometry locally for slurryDensity
declare module '../models/tampao.model' {
  interface PlugGeometry { slurryDensity?: number; }
}
