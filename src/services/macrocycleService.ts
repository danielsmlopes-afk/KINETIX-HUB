import { env } from '@/config/env';
import { askHeadCoachForMacrocycle } from './headCoachService';
import { escapeMarkdown } from './briefingService';
import { db } from '@/db';
import { races, athletes, plannedWorkouts } from '@/db/schema';
import { and, between, not, eq } from 'drizzle-orm';

export const macrocycleService = {
  async generateMacrocycle(raceName: string, distance: number, raceDate: Date, priority: string, raceId: string): Promise<void> {
    const dateStr = raceDate.toLocaleDateString('pt-BR');
    const today = new Date();
    
    // 1. Matemática de Datas (Semanas Disponíveis)
    const diffDays = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const semanasDisponiveis = Math.max(1, Math.floor(diffDays / 7));

    // 2. Buscar atleta principal para vincular os treinos
    const athleteList = await db.select().from(athletes).limit(1);
    if (athleteList.length === 0) return;
    const athlete = athleteList[0];

    // 3. Identificação de Calendário Concorrente
    const intermediariasDb = await db.select().from(races).where(
      and(between(races.date, today, raceDate), not(eq(races.id, raceId)))
    );

    const provasIntermediarias = intermediariasDb.length > 0 
      ? intermediariasDb.map(r => `${r.name} (${r.distance}km - ${r.category})`).join(', ')
      : 'Nenhuma';

    const regrasDinamicas = `Prioridade: ${priority}. Semanas: ${semanasDisponiveis}. Provas intermediárias: ${provasIntermediarias}. REGRAS: 1. Se < 16 semanas, comprima Fase de Base. Nunca corte Pico e Polimento. Se < 8 semanas, assuma Manutenção. 2. Semana Pós-Prova = Repouso Ativo. 3. Prova P2 deve ser alocada na Semana 4/5 ou 11/12. 4. Prova P3 é Treino de Luxo sem Tapering em Z3.`;

    try {
      const workouts = await askHeadCoachForMacrocycle({
        targetRaceName: raceName,
        targetRaceDate: dateStr,
        targetDistanceKm: distance,
        targetPaceInstruction: regrasDinamicas,
        athleteName: athlete.name || 'Comandante'
      });

      if (workouts && workouts.length > 0) {
        const inserts = workouts.map(w => ({
          athleteId: athlete.id,
          date: new Date(w.date),
          activityType: w.activityType,
          title: w.title,
          warmup: w.warmup || null,
          cooldown: w.cooldown || null,
          details: w.details || {}
        }));
        await db.insert(plannedWorkouts).values(inserts);
      }
      
      let header = `🚀 *PROJETO INICIADO: OPERAÇÃO ${escapeMarkdown(raceName)}*`;
      if (priority === 'P2' && intermediariasDb.some(r => r.category === 'P1')) {
        header = `🔄 *RECALCULANDO ROTA: Prova P2 inserida\\. Adaptando o bloco de construção do Macrociclo Principal\\.*`;
      } else if (priority === 'P3') {
        header = `🏃 *TREINO DE LUXO: OPERAÇÃO ${escapeMarkdown(raceName)}*`;
      }

      const message = `${header}
🎯 Alvo: ${distance}km \\| Data: ${escapeMarkdown(dateStr)} \\| Semanas: ${semanasDisponiveis}

✅ *${workouts.length} Treinos* táticos gerados e injetados na sua Planilha Mestre\\.`;

      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'MarkdownV2'
        })
      });
    } catch (error) {
      console.error('❌ Erro ao gerar macrociclo dinâmico via IA:', error);
    }
  }
};