import { deductInventory } from './inventoryService';

export async function calculateAndDeductGels(durationMinutes: number, gelItemId: string): Promise<number> {
  if (durationMinutes < 60) return 0;
  
  let gelsNeeded = 1; // 1º aos 60 minutos
  const remainingTime = durationMinutes - 60;
  
  if (remainingTime >= 30) {
    gelsNeeded += Math.floor(remainingTime / 30);
  }
  gelsNeeded += 1; // 1 Extra de segurança
  
  await deductInventory(gelItemId, gelsNeeded);

  return gelsNeeded;
}
