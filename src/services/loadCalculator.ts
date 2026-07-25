export function calculatePNL(baseEffort: number, altimetryMeters: number): number {
  // Fatoramento de Esforço x (1 + (Altimetria / 1000))
  return baseEffort * (1 + (altimetryMeters / 1000));
}
