export const TREADMILL_CONSTANTS = {
  WARMUP_KMH: 6.5,
  COOLDOWN_KMH: 4.5,
};

export function evaluateTreadmillRest(distanceMeters: number): 'Repouso Passivo' | 'Repouso Ativo' {
  return distanceMeters <= 800 ? 'Repouso Passivo' : 'Repouso Ativo';
}