import { z } from 'zod';
import { eq, and, inArray, desc, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { pendingActions, plannedWorkouts, bioimpedanceLogs, races, workoutSessions, strengthLogs, workoutTemplateItems } from '@/db/schema';
import { athleteRepository } from '@/repositories/athleteRepository';
import { telemetryRepository } from '@/repositories/telemetryRepository';
import { env } from '@/config/env';
import { briefingService } from './briefingService';
import { workoutBatchSchema } from '@/validators/workoutSchema';
import type { StravaRunData } from './coachService';

const bioSchema = z.object({
  date: z.string(), weight: z.number(), body_fat: z.number(), muscle_mass: z.number(), body_water: z.number(),
  visceral_fat: z.number(), metabolic_age: z.number(), tmb: z.number(), protein: z.number(), bone_mass: z.number(), health_notes: z.string().optional()
});

const raceSchema = z.object({
  name: z.string(), category: z.enum(['P1', 'P2', 'P3']), priority: z.string().optional(),
  date: z.string().datetime(), distance: z.number(),
  startTime: z.string(), startLocation: z.string(), address: z.string().optional(),
  latitude: z.number().optional(), longitude: z.number().optional(),
  isTarget: z.boolean().optional(), targetPace: z.string().min(4)
});

async function sendMsg(chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  }).catch(e => console.error('❌ Falha na API do Telegram:', e));
}

export const telegramMessageService = {
  async sendPhoto(chatId: number, photoBuffer: Buffer, caption: string): Promise<void> {
    try {
      console.log(`[Telegram] Enviando imagem cartográfica (Polyline) para o chat ${chatId}...`);
      const form = new FormData();
      form.append('chat_id', chatId.toString());
      form.append('caption', caption);
      form.append('parse_mode', 'Markdown'); // Garante suporte a negrito/clima na legenda

      const blob = new Blob([new Uint8Array(photoBuffer)], { type: 'image/png' });
      form.append('photo', blob, 'map.png');

      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        body: form
      });
    } catch (error) {
      console.error('❌ [Telegram] Falha ao enviar a foto cartográfica:', error);
    }
  },

  async sendPdfReport(chatId: number, pdfBuffer: Buffer, filename: string, caption: string): Promise<void> {
    try {
      console.log(`[Telegram] Enviando documento PDF (${filename}) para o chat ${chatId}...`);
      const form = new FormData();
      form.append('chat_id', chatId.toString());
      form.append('caption', caption);
      form.append('parse_mode', 'Markdown');
      // Converte o Buffer em Blob nativo (Suportado no Node.js 18+)
      const blob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
      form.append('document', blob, filename);

      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: form
      });
    } catch (error) {
      console.error('❌ [Telegram] Falha ao enviar o documento PDF:', error);
    }
  },

  async sendCoachFeedback(stravaData: StravaRunData, aiAnalysis: string): Promise<void> {
    try {
      console.log(`[Telegram] Formatando dossiê de telemetria para a atividade ${stravaData.id}...`);
      
      const chatId = Number(env.TELEGRAM_CHAT_ID);
      if (!chatId) throw new Error('TELEGRAM_CHAT_ID não configurado ou inválido.');

      const message = `🏃‍♂️ *RELATÓRIO DE TELEMETRIA TÁTICA* 🏃‍♂️\n\n` +
        `*Operação:* ${stravaData.name}\n` +
        `📈 *Distância:* ${stravaData.distanceKm} km\n` +
        `⏱️ *Pace Médio:* ${stravaData.paceStr} /km\n` +
        `🏔️ *Altimetria:* ${stravaData.elevationGain} m\n\n` +
        `🤖 *PARECER DO HEAD COACH IA:*\n` +
        `${aiAnalysis}`;

      await sendMsg(chatId, message);
      console.log(`✅ [Telegram] Dossiê enviado com sucesso ao Comandante.`);
    } catch (error) {
      console.error('❌ [Telegram] Falha ao enviar o feedback do Coach:', error);
    }
  },

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
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const tomorrow = new Date(`${todayStr}T00:00:00Z`);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const endOfTomorrow = new Date(tomorrow);
      endOfTomorrow.setUTCHours(23, 59, 59, 999);

      const workouts = await db.select().from(plannedWorkouts).where(
        and(
          eq(plannedWorkouts.athleteId, athlete.id),
          gte(plannedWorkouts.date, tomorrow),
          lte(plannedWorkouts.date, endOfTomorrow)
        )
      ).limit(1);

      if (workouts.length === 0) return sendMsg(chatId, "Descanso programado para amanhã. Sem ordem de operações.");

      const briefing = await briefingService.generateNightlyBriefing(workouts[0]);
      return sendMsg(chatId, briefing);
    }

    const jsonMatch = text.match(/[\{\[][\s\S]*[\}\]]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown> | Record<string, unknown>[];
        
        const bioP = bioSchema.safeParse(parsed);
        const bioArrayP = z.array(bioSchema).safeParse(parsed);
        
        const bioData = bioP.success ? [bioP.data] : (bioArrayP.success ? bioArrayP.data : null);
        if (bioData && bioData.length > 0) {
          for (const bio of bioData) {
            await db.delete(bioimpedanceLogs).where(and(eq(bioimpedanceLogs.athleteId, athlete.id), eq(bioimpedanceLogs.date, new Date(bio.date))));
            await telemetryRepository.insertLog(athlete.id, bio);
          }
          return sendMsg(chatId, `✅ *Bioimpedância Registrada!* (${bioData.length} leitura(s) salva(s))`);
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
  },

  async sendSimpleMessage(chatId: number, text: string): Promise<void> {
    await sendMsg(chatId, text);
  },
};