import { InferSelectModel, eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { races, athletes, bioimpedanceLogs } from '@/db/schema';
import { askHeadCoach } from './headCoachService';
import { getEstimatedTravelTime } from './routingService';
import { escapeMarkdown } from './briefingService';

type Race = InferSelectModel<typeof races>;
type Athlete = InferSelectModel<typeof athletes>;

export class MorningRaceService {
  
  /**
   * Utilitário para resgatar o peso do atleta da Bioimpedância
   */
  private async getAthleteWeight(athleteId: string): Promise<number> {
    const bio = await db.select().from(bioimpedanceLogs)
      .where(eq(bioimpedanceLogs.athleteId, athleteId))
      .orderBy(desc(bioimpedanceLogs.date))
      .limit(1);
    return bio.length > 0 ? bio[0].weight : 75; // Fallback militar
  }

  /**
   * PARTE 1: PROTOCOLO D-3 (Saturação de Glicogénio)
   */
  public async processD3(athleteId: string, race: Race): Promise<string> {
    const weight = await this.getAthleteWeight(athleteId);
    const systemPrompt = `Atue como Head Coach de Alta Performance. O atleta fará uma prova de ${race.distance}km em 3 dias. Peso: ${weight}kg. Clima previsto: ${race.weather || 'Desconhecido'}.
Tarefa: Gere 5 refeições (Café da manhã, Almoço, Lanches, Jantar) focadas no início da SATURAÇÃO DE GLICOGÉNIO.
Diretrizes Nutricionais: LINGUAGEM UNIVERSAL de comida (sem siglas, ex: aveia, batata, frango). Dê a ordem expressa para iniciar o corte de fibras brutas/saladas. Envie o clima.`;

    const aiResponse = await askHeadCoach(`Gerar protocolo de Saturação D-3 para ${race.name || race.category}`, undefined, systemPrompt);
    return `🚨 PROTOCOLO D-3: SATURAÇÃO DE GLICOGÉNIO\n\n${escapeMarkdown(aiResponse)}`;
  }

  /**
   * PARTE 2: PROTOCOLO D-2 (Pace Chart e Arsenal)
   */
  public async processD2(race: Race): Promise<string> {
    const systemPrompt = `Atue como Head Coach. A prova de ${race.distance}km é em 2 dias. Meta de Pace: ${race.targetPace || 'Não definido'}. Clima: ${race.weather || 'Desconhecido'}.
Tarefa 1 - Nutrição (D-2): Gere 5 refeições agressivas (arroz, macarrão, pão). LINGUAGEM UNIVERSAL de comida.
Tarefa 2 - Pace Chart: Crie uma estratégia de pace km a km.
Tarefa 3 - Arsenal de Gel: Calcule matematicamente os géis: T-15m + 1 a cada 35-40min + 1 c/ cafeína no terço final.
Finalize com uma frase de foco.`;

    const aiResponse = await askHeadCoach(`Gerar Pace Chart e Protocolo D-2 para ${race.name || race.category}`, undefined, systemPrompt);
    return `🚨 PROTOCOLO D-2: PACE CHART E ARSENAL\n\n${escapeMarkdown(aiResponse)}`;
  }

  /**
   * PARTE 3: PROTOCOLO D-1 (Logística de Deslocamento e Véspera)
   */
  public async processD1(athlete: Athlete, race: Race): Promise<string> {
    let travelMins = 60; // Margem de segurança caso não tenhamos as coordenadas
    if (athlete.homeLat && athlete.homeLon && race.latitude && race.longitude) {
      travelMins = await getEstimatedTravelTime(athlete.homeLat, athlete.homeLon, race.latitude, race.longitude, race.address || '');
    }
    
    if (race.address && !race.address.toLowerCase().includes('são paulo')) {
      travelMins = Math.floor(travelMins * 1.5) + 30;
    }

    const [hr, min] = (race.startTime || '06:00').split(':').map(Number);
    const wakeMins = (hr * 60 + (min || 0)) - 60 - travelMins - 45; // Relógio na arena vs trânsito vs se vestir
    const normalized = (wakeMins + 24 * 60) % (24 * 60);
    const wakeUpTime = `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(Math.floor(normalized % 60)).padStart(2, '0')}`;

    const systemPrompt = `Atue como Head Coach. Amanhã é o dia da prova de ${race.distance}km.
Tarefa 1 - Checklist de Combate: Liste a preparação do equipamento (chip, número de peito).
Tarefa 2 - Nutrição da Véspera: Jantar até às 19h.`;

    const aiResponse = await askHeadCoach(`Gerar Checklist D-1 para ${race.name || race.category}`, undefined, systemPrompt);
    const wazeLink = (race.latitude && race.longitude) ? `https://waze.com/ul?ll=${race.latitude},${race.longitude}&navigate=yes` : 'N/D';
    const template = `🚨 ORDEM DE EXECUÇÃO: VÉSPERA DA PROVA (D-1)\n📍 Operação: ${race.name || race.category} | ${race.address || 'N/D'}\n🚗 Trânsito Estimado (OSRM): ${travelMins} min.\n⏰ Ignição (Largada): ${race.startTime}.\n🛌 Despertar Tático: ${wakeUpTime}.\n\n${aiResponse}`;

    return `${escapeMarkdown(template)}\n\n🔗 Rota de Aproximação (Waze): Link`;
  }

  /**
   * Orquestrador executado pelo CronJob matinal
   */
  public async executeMorningRoutines(): Promise<void> {
    console.log('[MorningRaceService] Executando varredura matinal de provas alvo (D-3, D-2, D-1)...');
    // TODO: Implementar busca de provas nos próximos 3 dias e acionar os protocolos D-3, D-2 e D-1
  }
}
export const morningRaceService = new MorningRaceService();