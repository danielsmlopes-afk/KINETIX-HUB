import { z } from 'zod';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { db } from '@/db';
import { pendingActions, plannedWorkouts, bioimpedanceLogs, races, workoutSessions, strengthLogs, workoutTemplateItems } from '@/db/schema';
import { athleteRepository } from '@/repositories/athleteRepository';
import { telemetryRepository } from '@/repositories/telemetryRepository';
import { env } from '@/config/env';
import { briefingService } from './briefingService';
import { workoutBatchSchema } from '@/validators/workoutSchema';

const bioSchema = z.object({
  date: z.string(), weight: z.number(), body_fat: z.number(), muscle_mass: z.number(), body_water: z.number(),
  visceral_fat: z.number(), metabolic_age: z.number(), tmb: z.number(), protein: z.number(), bone_mass: z.number(), health_notes: z.string().optional()
});

const raceSchema = z.object({
  name: z.string(), category: z.enum(['P1', 'P2', 'P3']), date: z.string().datetime(), distance: z.number(),
  startTime: z.string(), startLocation: z.string(), isTarget: z.boolean().optional(), targetPace: z.string().min(4)
});

async function sendMsg(chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  }).catch(e => console.error('❌ Falha na API do Telegram:', e));
}

export const telegramMessageService = {
  async processIncomingMessage(chatId: number, text: string): Promise<void> {
    const cmd = text.trim().toUpperCase();

    if (cmd === '/AJUDA' || cmd === '/HELP') {
      const help = `🤖 *KINETIX HUB - Central*\n\n*1. Prova Alvo (JSON):*\n\`\`\`json\n{"name":"Prova","category":"P1","date":"2026-10-10T06:00:00Z","distance":21,"startTime":"06:00","startLocation":"SP","targetPace":"5:00"}\n\`\`\`\n*2. Auditoria:* Envie \`/auditoria\`\n*3. Briefing:* Envie \`/briefing\` para o resumo de amanhã\n*4. IA:* Responda \`OK\` p/ aprovar recálculos.`;
      return sendMsg(chatId, help);
    }

    const athlete = await athleteRepository.getPrimaryAthlete();
    if (!athlete) return sendMsg(chatId, "❌ Atleta principal não encontrado.");

    if (cmd === 'OK') {
      const pending = await db.select().from(pendingActions).where(eq(pendingActions.athleteId, athlete.id));
      if (pending.length > 0) {
        for (const act of pending) {
          if (act.action === 'CANCEL') await db.delete(plannedWorkouts).where(eq(plannedWorkouts.id, act.workoutId));
          else if (act.action === 'RESCHEDULE' && act.newDate) await db.update(plannedWorkouts).set({ date: act.newDate }).where(eq(plannedWorkouts.id, act.workoutId));
        }
        await db.delete(pendingActions).where(eq(pendingActions.athleteId, athlete.id));
        return sendMsg(chatId, "✅ *Aprovado! Mudanças aplicadas no calendário.*");
      }
      return sendMsg(chatId, "Nenhuma ação pendente da IA.");
    }

    if (cmd === '/AUDITORIA') {
      const last = await db.select({ sId: strengthLogs.sessionId, eId: strengthLogs.exerciseId }).from(strengthLogs)
        .innerJoin(workoutSessions, eq(strengthLogs.sessionId, workoutSessions.id)).where(eq(workoutSessions.athleteId, athlete.id)).orderBy(desc(workoutSessions.date)).limit(1);
      if (!last.length) return sendMsg(chatId, "❌ *Nenhum treino de força na base.*");
      
      const tpl = await db.select({ tId: workoutTemplateItems.templateId }).from(workoutTemplateItems).where(eq(workoutTemplateItems.exerciseId, last[0].eId)).limit(1);
      if (!tpl.length) return sendMsg(chatId, "⚠️ Não foi possível associar a Ficha original.");
      
      const url = `${process.env.RENDER_EXTERNAL_URL || 'https://kinetix-api-7jld.onrender.com'}/api/reports/strength-audit/${last[0].sId}?templateId=${tpl[0].tId}`;
      return sendMsg(chatId, `📄 *Auditoria de Força*\n\n🔗 Download do Dossiê PDF`);
    }

    if (cmd === '/BRIEFING') {
      const briefing = await briefingService.generateDailyBriefing();
      return sendMsg(chatId, briefing);
    }

    const jsonMatch = text.match(/[\{\[][\s\S]*[\}\]]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown> | Record<string, unknown>[];
        
        const bioP = bioSchema.safeParse(parsed);
        if (bioP.success) {
          await db.delete(bioimpedanceLogs).where(and(eq(bioimpedanceLogs.athleteId, athlete.id), eq(bioimpedanceLogs.date, new Date(bioP.data.date))));
          await telemetryRepository.insertLog(athlete.id, bioP.data);
          return sendMsg(chatId, "✅ *Bioimpedância Registrada!*");
        }

        const raceP = raceSchema.safeParse(parsed);
        if (raceP.success) {
          await db.insert(races).values({ ...raceP.data, date: new Date(raceP.data.date) });
          return sendMsg(chatId, "✅ *Prova Registrada no Calendário!*");
        }

        let workouts: unknown = parsed;
        if (!Array.isArray(parsed) && typeof parsed === 'object' && parsed !== null) {
          const values = Object.values(parsed);
          if (values.length > 0 && typeof values[0] === 'object' && values[0] !== null) {
            const inner = values[0] as Record<string, unknown>;
            if (Array.isArray(inner.exercicios)) {
              workouts = inner.exercicios.map((ex: Record<string, unknown>) => {
                const k = Object.keys(ex).find(k => k !== 'dia');
                if (!k) return null;
                const map: Record<string, 'RUN'|'BIKE'|'STRENGTH'> = { corrida: 'RUN', bike: 'BIKE', musculacao: 'STRENGTH' };
                if (!map[k]) return null;
                const { atividade, ...details } = ex[k] as Record<string, unknown>;
                return { date: new Date(ex.dia as string).toISOString(), type: map[k], title: atividade, details: Object.fromEntries(Object.entries(details).filter(x => x[1] !== null)) };
              }).filter(Boolean);
            }
          }
        }

        const wP = workoutBatchSchema.safeParse(workouts);
        if (wP.success && wP.data.length > 0) {
          const dates = Array.from(new Set(wP.data.map(w => new Date(w.date).toISOString()))).map(d => new Date(d));
          await db.delete(plannedWorkouts).where(and(eq(plannedWorkouts.athleteId, athlete.id), inArray(plannedWorkouts.date, dates)));
          await db.insert(plannedWorkouts).values(wP.data.map(w => ({ athleteId: athlete.id, date: new Date(w.date), activityType: w.type, title: w.title, details: w.details || {}, isImported: true })));
          return sendMsg(chatId, `✅ *Planilha Importada!* (${wP.data.length} treinos injetados)`);
        }
        
        return sendMsg(chatId, "⚠️ *Atenção:* O JSON não corresponde a um formato válido.");
      } catch (e) {
        return sendMsg(chatId, "❌ Falha ao interpretar JSON.");
      }
    }
  }
};