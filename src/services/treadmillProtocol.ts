export const TREADMILL_CONSTANTS = {
  WARMUP_KMH: 6.5,
  COOLDOWN_KMH: 4.5,
};

export const TREADMILL_AUDITOR_PROMPT = `
DIRETRIZES DE AUDITORIA DE DISTÂNCIA (OPERAÇÕES EM ESTEIRA E PISTA):

REGRA 1 - VELOCIDADE NÃO É DISTÂNCIA:
Se a missão contiver textos como "a [X]km" ou "a [X]km/h" logo após a metragem de um tiro (ex: "8x400m a 10.6km"), este valor é EXCLUSIVAMENTE a velocidade da lona. Ignore-o completamente ao definir a meta de distância.

REGRA 2 - CÁLCULO ESTRITO DE DISTÂNCIA ALVO (O ALGORITMO DE SOMA):
A distância alvo real não está explícita. Você DEVE calculá-la somando exatamente 4 fatores:
1. AQUECIMENTO: Distância inicial (ex: 2km).
2. DESAQUECIMENTO: Distância final (ex: 1.5km).
3. VOLUME DE TIROS: Multiplique o número de tiros pela distância (ex: 8 x 400m = 3.2km).
4. DISTÂNCIA DA PAUSA (Dinâmica da Lona da Esteira):
   - Tempo Total de Pausa: (Número de Tiros - 1) * Tempo da Pausa (em minutos). Ex: 8 tiros com 1 min de pausa = 7 minutos totais de repouso.
   - COMO DEFINIR A VELOCIDADE DA LONA NA PAUSA:
     * SE o tiro for <= 800m (ex: 400m, 800m): A lona não para (o atleta pula para a lateral). A velocidade da pausa é a MESMA do tiro (ex: 10.6 km/h). Cálculo: (Tempo / 60) * 10.6 = Distância da pausa.
     * SE o tiro for > 800m (ex: 1000m, 1200m): A lona é reduzida obrigatoriamente. A velocidade da pausa é FIXA em 3 km/h. Cálculo: (Tempo / 60) * 3 = Distância da pausa.

MÉTRICA FINAL DE VALIDAÇÃO: 
Some os 4 fatores (Aquecimento + Desaquecimento + Volume de Tiros + Distância da Pausa).
- Exemplo: 2km + 1.5km + 3.2km + 1.24km = 7.94km.
- Se a quilometragem lida do Strava estiver dentro de uma margem razoável (aprox. 5%) deste cálculo final, o Status é "COMPLETED".
`;

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
      const distanceMeters = planned.intervals[0].distanceMeters;
      
      let pauseSpeedKmh = 0;
      if (distanceMeters <= 800) {
        pauseSpeedKmh = planned.intervals[0].speedKmh;
      } else {
        pauseSpeedKmh = 3.0; // Velocidade fixa para tiros longos
      }
      
      const distanciaEsteiraRodando = tempoTotalRepouso * pauseSpeedKmh;
      finalTargetDistance = planned.targetDistanceKm + distanciaEsteiraRodando;
    }
  }

  // 1. Validação de Volume (Tolerância alinhada em ±5% conforme Diretriz do Head Coach)
  const margin = 0.05;
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