import { getEstimatedTravelTime } from './routingService';

export function getNutritionProtocol(priority: string, distanceKm: number, stage: 'D-3_NIGHT' | 'D-2_NIGHT'): string {
  if (priority === 'P1' && stage === 'D-3_NIGHT') {
    return "🌅 Pequeno-almoço: Reforço C1 e C2.\n🍛 Almoço: P1 + C1. Iniciar REDUÇÃO de V1, V2 e C3.\n🥪 Lanches: Foco em C2 e hidratação.\n🌙 Jantar: Porção dobrada de hidratos limpos. Restrição total de fibras.";
  }
  if (priority === 'P1' && stage === 'D-2_NIGHT') {
    return "🌅 Pequeno-almoço: Foco C2 (ex: pão francês sem miolo, banana, queijo minas, café c/ leite).\n🍛 Almoço: C2 absoluto + P1. Fibras ZERADAS.\n🥪 Lanches: Leves/líquidos.\n🌙 Jantar: JANTAR CEDO. C2 limpo, zero P2. Foco no esvaziamento gástrico.";
  }
  return "Protocolo base de nutrição pré-prova. Mantenha hidratação e carboidratos limpos adequados.";
}

export async function processPreRaceLogic(
  race: { date: Date | string, priority: string, distance: number, latitude: number | null, longitude: number | null, address: string | null, startTime: string }, 
  athleteHomeLat: number, 
  athleteHomeLon: number
) {
  const today = new Date();
  const rDate = new Date(race.date);
  
  // Zerando fuso da string para a diferença exata da janela de dias
  rDate.setUTCHours(0, 0, 0, 0);
  today.setUTCHours(0, 0, 0, 0);

  const diffDays = Math.ceil((rDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  let stage = '';
  let protocol = '';
  let wakeUpTime = '';

  if (diffDays === 3) {
    stage = 'D-3_NIGHT';
    protocol = getNutritionProtocol(race.priority, race.distance, stage as 'D-3_NIGHT');
  } else if (diffDays === 2) {
    stage = 'D-2_NIGHT';
    protocol = getNutritionProtocol(race.priority, race.distance, stage as 'D-2_NIGHT');
    if (race.latitude && race.longitude) {
      const travelMins = await getEstimatedTravelTime(athleteHomeLat, athleteHomeLon, race.latitude, race.longitude, race.address || '');
      const [hr, min] = (race.startTime || '06:00').split(':').map(Number);
      const wakeMins = (hr * 60 + min) - 60 - travelMins - 45; // Relógio da arena vs logística
      const normalized = (wakeMins + 24 * 60) % (24 * 60);
      wakeUpTime = `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(Math.floor(normalized % 60)).padStart(2, '0')}`;
    }
  }
  return { stage, protocol, wakeUpTime, diffDays };
}
