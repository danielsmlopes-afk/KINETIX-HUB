export const TREADMILL_CONSTANTS = {
  WARMUP_KMH: 6.5,
  COOLDOWN_KMH: 4.5,
};

export interface PlannedTreadmillDetails {
  targetDistanceKm: number;
  targetPace?: string;
  intervals?: Array<{ distanceMeters: number; speedKmh: number }>;
  restDetails?: string;
}

export interface StravaTreadmillData {
  distanceKm: number;
  movingTimeSeconds: number;
  laps?: Array<{ distanceMeters: number; movingTimeSeconds: number }>;
}

/**
 * Valida se um treino executado indoor (esteira) está em conformidade com o planejado.
 */
export function validateTreadmillIntervals(planned: PlannedTreadmillDetails, actual: StravaTreadmillData): boolean {
  if (planned.targetDistanceKm <= 0) return true; // Treino livre

  let finalTargetDistance = planned.targetDistanceKm;
  let isPassiveRest = false;

  if (planned.restDetails && planned.restDetails.toLowerCase().includes('passivo') && planned.intervals && planned.intervals.length > 0) {
    isPassiveRest = true;
    const tiros = planned.intervals.length;
    let restTimeHours = 0;
    
    const matchMin = planned.restDetails.match(/(\d+)\s*min/i);
    const matchSec = planned.restDetails.match(/(\d+)\s*s(?:eg)?/i);
    
    if (matchMin) {
      restTimeHours = parseInt(matchMin[1], 10) / 60;
    } else if (matchSec) {
      restTimeHours = parseInt(matchSec[1], 10) / 3600;
    }

    if (tiros > 1 && restTimeHours > 0) {
      const tempoTotalRepouso = (tiros - 1) * restTimeHours;
      const velocidadeTiro = planned.intervals[0].speedKmh;
      const distanciaEsteiraRodando = tempoTotalRepouso * velocidadeTiro;
      finalTargetDistance = planned.targetDistanceKm + distanciaEsteiraRodando;
    }
  }

  // 1. Validação de Volume (Tolerância de ±2% repouso passivo, ou ±3% geral)
  const margin = isPassiveRest ? 0.02 : 0.03;
  const minDistance = finalTargetDistance * (1 - margin);
  const maxDistance = finalTargetDistance * (1 + margin);
  const isVolumeValid = actual.distanceKm >= minDistance && actual.distanceKm <= maxDistance;

  // 2. Validação de Intensidade (Reconstrução pelo Pace/Tempo total caso não existam laps detalhados)
  let isIntensityValid = true;
  if (!isPassiveRest && planned.targetPace && planned.targetPace !== 'Livre') {
    const [min, sec] = planned.targetPace.replace(' min/km', '').split(':').map(Number);
    const targetPaceSecs = (min * 60) + (sec || 0);
    const actualPaceSecs = actual.distanceKm > 0 ? actual.movingTimeSeconds / actual.distanceKm : 0;
    
    // Tolerância na esteira de ±10s/km (ambiente controlado)
    isIntensityValid = Math.abs(actualPaceSecs - targetPaceSecs) <= 10;
  }

  return isVolumeValid && isIntensityValid;
}

export function evaluateTreadmillRest(distanceMeters: number): 'Repouso Passivo' | 'Repouso Ativo' {
  return distanceMeters <= 800 ? 'Repouso Passivo' : 'Repouso Ativo';
}