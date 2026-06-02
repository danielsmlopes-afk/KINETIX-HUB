import { InferSelectModel, and, eq, gte, lte } from 'drizzle-orm';
import { plannedWorkouts, athletes } from '../db/schema';
import { db } from '@/db';
import { askHeadCoach } from './headCoachService';
import { env } from '@/config/env';
import { getTomorrowWeather } from './weatherService';

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
   * Extrai a probabilidade de chuva e temperatura para as próximas 24h via OpenWeatherMap
   */
  public async getWeatherPoP(lat?: number | null, lon?: number | null): Promise<string> {
    try {
      const apiKey = env.OPENWEATHER_API_KEY;
      if (!apiKey) return '🌦️ N/D';
      
      const targetLat = lat ?? -23.5505; // Coordenada tática por padrão (São Paulo)
      const targetLon = lon ?? -46.6333;
      
      const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${targetLat}&lon=${targetLon}&appid=${apiKey}&units=metric`);
      if (!res.ok) return '🌦️ N/D';
      const data = await res.json() as { list?: Array<{ pop?: number, main?: { temp?: number } }> };
      const forecast = data.list?.[8]; // Índice 8 = Previsão de +24h
      const pop = forecast?.pop || 0; 
      const temp = forecast?.main?.temp;
      
      const popStr = `🌦️ ${(pop * 100).toFixed(0)}% chance de chuva`;
      return temp ? `${popStr} | 🌡️ ${temp.toFixed(1)}°C` : popStr;
    } catch {
      return '🌦️ N/D';
    }
  }

  /**
   * Orquestrador do Briefing Diário (Executado pelo cronjob às 22h00)
   */
  public async generateNightlyBriefing(workout: PlannedWorkout): Promise<string> {
    // Parse rígido e seguro da coluna JSONB 'details'
    const details = workout.details as { corrida?: string; academia?: string; bike?: string; restDetails?: string } | null;
    
    // Constrói a "Série Principal" a partir das colunas isoladas V11+
    const seriePrincipalParts = [details?.corrida, details?.academia, details?.bike].filter(Boolean);
    const seriePrincipal = seriePrincipalParts.length > 0 ? seriePrincipalParts.join(' + ') : 'Treino Base';
    const restDetails = details?.restDetails ?? null;

    // PARTE 1.5: Motor de Sumário Tático (Calcula a cadência da semana corrente)
    let tacticalSummary = '';
    try {
      const workoutDate = new Date(workout.date);
      const startOfWeek = new Date(workoutDate);
      startOfWeek.setUTCDate(workoutDate.getUTCDate() - workoutDate.getUTCDay()); // Retrocede ao Domingo
      startOfWeek.setUTCHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6); // Avança ao Sábado
      endOfWeek.setUTCHours(23, 59, 59, 999);

      const weekWorkouts = await db.select().from(plannedWorkouts).where(
        and(
          eq(plannedWorkouts.athleteId, workout.athleteId),
          gte(plannedWorkouts.date, startOfWeek),
          lte(plannedWorkouts.date, endOfWeek)
        )
      );

      let totalKm = 0;
      let strengthSessions = 0;
      let bikeSessions = 0;
      
      for (const w of weekWorkouts) {
        const wDetails = w.details as { corrida?: string; academia?: string; bike?: string } | null;
        if (wDetails?.corrida && wDetails.corrida.trim() !== '' && wDetails.corrida.trim().toLowerCase() !== 'null' && wDetails.corrida.trim().toUpperCase() !== 'OFF') {
          const match = wDetails.corrida.match(/(\d+(?:[\.,]\d+)?)\s*km/i);
          if (match) totalKm += parseFloat(match[1].replace(',', '.'));
        }
        if (wDetails?.academia && wDetails.academia.trim() !== '' && wDetails.academia.trim().toLowerCase() !== 'null' && wDetails.academia.trim().toUpperCase() !== 'OFF') {
          strengthSessions++;
        }
        if (wDetails?.bike && wDetails.bike.trim() !== '' && wDetails.bike.trim().toLowerCase() !== 'null' && wDetails.bike.trim().toUpperCase() !== 'OFF') {
          bikeSessions++;
        }
      }
      tacticalSummary = `\n📊 SUMÁRIO TÁTICO DA SEMANA:\n🏃 Pista: ${totalKm > 0 ? totalKm.toFixed(1) + ' KM' : '-'} | 🏋️ Força: ${strengthSessions} Sessão(ões) | 🚴 Base: ${bikeSessions} Sessão(ões)\n`;
    } catch (error) {
      console.error('❌ [BriefingService] Erro ao calcular Sumário Tático:', error);
    }

    // Chamada ao Motor Cognitivo (IA Gemini via askHeadCoach)
    const popStr = await this.getWeatherPoP();
    const visualWeather = await getTomorrowWeather(); // Integração de Log Visual via OpenWeatherMap
    
    const systemPrompt = this.getLogisticsSystemPrompt();
    const userPrompt = `Alvo: ${workout.title}\nTipo: ${workout.activityType}\nSérie Principal: ${seriePrincipal}`;
    const aiResponse = await askHeadCoach(userPrompt, undefined, systemPrompt);

    // PARTE 2: Montagem do Template Tático no padrão MarkdownV2 do Telegram
    const briefingMarkdown = `⚙️ ORDEM DE OPERAÇÃO: TREINO
🔸 Alvo: ${escapeMarkdown(workout.title)}
   🔥 Ignição: ${escapeMarkdown(workout.warmup)}
   ⚡ Série Principal: ${escapeMarkdown(seriePrincipal)}
   ⏸️ Protocolo de Repouso: ${escapeMarkdown(restDetails)}
   ❄️ Resfriamento: ${escapeMarkdown(workout.cooldown)}
   ${escapeMarkdown(popStr)}
   ☁️ Visual Climático: ${escapeMarkdown(visualWeather)}
${escapeMarkdown(tacticalSummary)}
🎒 ARSENAL LOGÍSTICO & MACROCICLO:
${escapeMarkdown(aiResponse)}`;

    return briefingMarkdown;
  }

  /**
   * Orquestrador executado pelo CronJob diário
   */
  public async executeBriefing(): Promise<void> {
    console.log('[BriefingService] Executando varredura de briefing diário...');
    try {
      const athleteList = await db.select().from(athletes).limit(1);
      if (athleteList.length === 0) return;
      const athlete = athleteList[0];

      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const tomorrow = new Date(`${todayStr}T00:00:00Z`);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const endOfTomorrow = new Date(tomorrow);
      endOfTomorrow.setUTCHours(23, 59, 59, 999);

      const workouts = await db.select().from(plannedWorkouts).where(
        and(eq(plannedWorkouts.athleteId, athlete.id), gte(plannedWorkouts.date, tomorrow), lte(plannedWorkouts.date, endOfTomorrow))
      ).limit(1);

      if (workouts.length > 0) {
        const briefingMarkdown = await this.generateNightlyBriefing(workouts[0]);
        if (env.TELEGRAM_CHAT_ID && env.TELEGRAM_BOT_TOKEN) {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: briefingMarkdown, parse_mode: 'MarkdownV2' })
          });
        }
      }
    } catch (error) {
      console.error('❌ [BriefingService] Falha na execução do Briefing:', error);
    }
  }
}

export const briefingService = new BriefingService();