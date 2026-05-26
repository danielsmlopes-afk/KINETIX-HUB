import { InferSelectModel } from 'drizzle-orm';
import { plannedWorkouts } from '../db/schema';
import { askHeadCoach } from './headCoachService';
import { env } from '@/config/env';

// Tipagem estrita inferida do Drizzle ORM (Zero 'any')
type PlannedWorkout = InferSelectModel<typeof plannedWorkouts>;

/**
 * Utilitário vital para escapar caracteres reservados do Telegram MarkdownV2
 * Evita que a API do Telegram recuse a mensagem por formatação inválida.
 */
export function escapeMarkdown(text: string | null | undefined): string {
  if (!text) return 'N/D';
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

export class BriefingService {
  
  /**
   * PARTE 1: Contexto de IA para o Arsenal Logístico
   */
  private getLogisticsSystemPrompt(): string {
    return `Atue como um Head Coach de Elite. Foco exclusivo no treino de amanhã.
IA Injeta:
1. Visão do Macrociclo: 2 linhas sobre adaptação biológica para os 21km (ex: VO2 Max).
2. Arsenal Logístico: Checklist. Sem gel para tiros/indoor; Gel só para > 6km.
3. Mentalidade: 1 frase militar.
Use um tom clínico, focado em performance e proteção.`;
  }

  /**
   * Extrai a probabilidade de chuva para as próximas 24h via OpenWeatherMap
   */
  private async getWeatherPoP(): Promise<string> {
    try {
      const apiKey = env.OPENWEATHER_API_KEY;
      if (!apiKey) return '🌦️ N/D';
      // Coordenadas táticas por padrão (São Paulo)
      const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=-23.5505&lon=-46.6333&appid=${apiKey}&units=metric`);
      if (!res.ok) return '🌦️ N/D';
      const data = await res.json() as { list?: Array<{ pop?: number }> };
      const pop = data.list?.[8]?.pop || 0; // Índice 8 = Previsão de +24h
      return `🌦️ ${(pop * 100).toFixed(0)}% chance de chuva`;
    } catch {
      return '🌦️ N/D';
    }
  }

  /**
   * Orquestrador do Briefing Diário (Executado pelo cronjob às 22h00)
   */
  public async generateNightlyBriefing(workout: PlannedWorkout): Promise<string> {
    // Parse rígido e seguro da coluna JSONB 'details'
    const details = workout.details as Record<string, unknown> | null;
    const seriePrincipal = typeof details?.subtitle === 'string' ? details.subtitle : 'Treino Base';

    // Chamada ao Motor Cognitivo (IA Gemini via askHeadCoach)
    const popStr = await this.getWeatherPoP();
    const systemPrompt = this.getLogisticsSystemPrompt();
    const userPrompt = `Alvo: ${workout.title}\nTipo: ${workout.activityType}\nDistância/Tempo: ${JSON.stringify(details)}`;
    const aiResponse = await askHeadCoach(userPrompt, undefined, systemPrompt);

    // PARTE 2: Montagem do Template Tático no padrão MarkdownV2 do Telegram
    const briefingMarkdown = `⚙️ ORDEM DE OPERAÇÃO: TREINO
🔸 Alvo: ${escapeMarkdown(workout.title)}
   🔥 Ignição: ${escapeMarkdown(workout.warmup)}
   ⚡ Série Principal: ${escapeMarkdown(seriePrincipal)}
   ⏸️ Protocolo de Repouso: ${escapeMarkdown(workout.restDetails)}
   ❄️ Resfriamento: ${escapeMarkdown(workout.cooldown)}
   ${escapeMarkdown(popStr)}
   
🎒 ARSENAL LOGÍSTICO & MACROCICLO:
${escapeMarkdown(aiResponse)}`;

    return briefingMarkdown;
  }
}

export const briefingService = new BriefingService();