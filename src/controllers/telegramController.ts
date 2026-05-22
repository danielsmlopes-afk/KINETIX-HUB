// Arquivo: src/controllers/telegramController.ts
import { Context } from 'hono';
import { z } from 'zod';
import { telemetryRepository } from '@/repositories/telemetryRepository';
import { athleteRepository } from '@/repositories/athleteRepository';
import { runDailyBriefingJob, runRouteRecalculationJob } from '@/services/cronJobs';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { pendingActions, plannedWorkouts, bioimpedanceLogs } from '@/db/schema';
import { env } from '@/config/env';
import { workoutBatchSchema } from '@/validators/workoutSchema';

const bioimpedanceSchema = z.object({
  date: z.string(),
  weight: z.number(),
  body_fat: z.number(),
  muscle_mass: z.number(),
  body_water: z.number(),
  visceral_fat: z.number(),
  metabolic_age: z.number(),
  tmb: z.number(),
  protein: z.number(),
  bone_mass: z.number(),
  health_notes: z.string().optional(),
});

export const telegramController = {
  async handleWebhook(c: Context) {
    try {
      const body = await c.req.json().catch(() => ({}));

      // Intercepta mensagens do bot oficial do Telegram (Humano no Ciclo)
      if (body.message && typeof body.message.text === 'string') {
        const text = body.message.text.trim();
        
        if (text.toUpperCase() === 'OK') {
          const athlete = await athleteRepository.getPrimaryAthlete();
          if (!athlete) return c.json({ error: "Atleta principal não encontrado." }, 404);

          const pending = await db.select().from(pendingActions).where(eq(pendingActions.athleteId, athlete.id));
          
          if (pending.length > 0) {
            for (const action of pending) {
              if (action.action === 'CANCEL') {
                await db.delete(plannedWorkouts).where(eq(plannedWorkouts.id, action.workoutId));
              } else if (action.action === 'RESCHEDULE' && action.newDate) {
                await db.update(plannedWorkouts).set({ date: action.newDate }).where(eq(plannedWorkouts.id, action.workoutId));
              }
            }
            
            await db.delete(pendingActions).where(eq(pendingActions.athleteId, athlete.id));
            
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: "✅ *Aprovado! Modificações aplicadas com sucesso no seu calendário.*", parse_mode: 'Markdown' })
            });
          }
          return c.text('OK_PROCESSED', 200);
        }

        // Extrai o bloco JSON ignorando textos antes ou depois (ex: "Aqui está o treino:\n```json ... ```")
        const jsonMatch = text.match(/[\{\[][\s\S]*[\}\]]/);

        // Tenta processar envio de JSON via Chat
        if (jsonMatch) {
          try {
            const jsonString = jsonMatch[0];
            const parsedJson = JSON.parse(jsonString);
            
            // 1. Tenta validar como Bioimpedância
            const bioParsed = bioimpedanceSchema.safeParse(parsedJson);
            if (bioParsed.success) {
              const athlete = await athleteRepository.getPrimaryAthlete();
              if (athlete) {
                // Remove bioimpedância existente da mesma data/hora para evitar duplicidade
                await db.delete(bioimpedanceLogs).where(
                  and(
                    eq(bioimpedanceLogs.athleteId, athlete.id),
                    eq(bioimpedanceLogs.date, new Date(bioParsed.data.date))
                  )
                );
                await telemetryRepository.insertLog(athlete.id, bioParsed.data);
                await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: "✅ *Bioimpedância Registrada!*\nSeus dados de composição corporal foram atualizados.", parse_mode: 'Markdown' })
                });
                return c.text('BIO_IMPORTED', 200);
              }
            }

            // 2. Se não for bioimpedância, assume que é treino
            let workoutsToParse = parsedJson;

            // "Tradutor" para o formato de planilha que você enviou
            if (!Array.isArray(parsedJson) && Object.values(parsedJson)[0] && typeof Object.values(parsedJson)[0] === 'object' && 'exercicios' in (Object.values(parsedJson)[0] as any)) {
              const typeMap: Record<string, 'RUN' | 'BIKE' | 'STRENGTH'> = {
                corrida: 'RUN',
                bike: 'BIKE',
                musculacao: 'STRENGTH'
              };

              const exercicios = (Object.values(parsedJson)[0] as any).exercicios as any[];
              workoutsToParse = exercicios.map((ex) => {
                const activityKey = Object.keys(ex).find(k => k !== 'dia');
                if (!activityKey || !typeMap[activityKey]) return null;

                const activityDetails = ex[activityKey];
                const { atividade, ...rawDetails } = activityDetails;

                // Remove valores nulos para evitar falhas no Zod (ex: "velocidade": null)
                const details = Object.fromEntries(
                  Object.entries(rawDetails).filter(([_, v]) => v !== null)
                );

                return {
                  date: new Date(ex.dia).toISOString(),
                  type: typeMap[activityKey],
                  title: atividade,
                  details: details
                };
              }).filter(Boolean);
            }

            const workoutParsed = workoutBatchSchema.safeParse(workoutsToParse);

            if (workoutParsed.success && workoutParsed.data.length > 0) {
              const athlete = await athleteRepository.getPrimaryAthlete();
              if (athlete) {
                // Remove duplicatas dentro do próprio payload enviado (Mesmo dia e mesmo tipo)
                const uniqueWorkoutsMap = new Map<string, typeof workoutParsed.data[0]>();
                for (const w of workoutParsed.data) {
                  uniqueWorkoutsMap.set(`${w.date}-${w.type}`, w);
                }
                const workouts = Array.from(uniqueWorkoutsMap.values());
                const uniqueDateStrings = Array.from(new Set(workouts.map(w => new Date(w.date).toISOString()))) as string[];
                const datesToClear = uniqueDateStrings.map(d => new Date(d));

                await db.delete(plannedWorkouts).where(and(eq(plannedWorkouts.athleteId, athlete.id), inArray(plannedWorkouts.date, datesToClear)));

                const valuesToInsert = workouts.map(w => ({
                  athleteId: athlete.id,
                  date: new Date(w.date),
                  activityType: w.type,
                  title: w.title,
                  details: w.details || {},
                  isImported: true
                }));

                await db.insert(plannedWorkouts).values(valuesToInsert);

                await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `✅ *Planilha Importada!*\n${workouts.length} treinos foram adicionados ao seu calendário via Telegram.`, parse_mode: 'Markdown' })
                });
                return c.text('WORKOUTS_IMPORTED', 200);
              }
            } else if (!workoutParsed.success) {
              console.error('❌ Erro de validação Zod no JSON do Telegram:', JSON.stringify(workoutParsed.error.format()));
              await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `❌ *Falha na Validação*\nO JSON enviado não corresponde a um formato válido de Treino ou Bioimpedância.`, parse_mode: 'Markdown' })
              });
            } else {
              await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `⚠️ *Nenhum treino encontrado*\nO JSON não continha treinos válidos ou a lista estava vazia.`, parse_mode: 'Markdown' })
              });
            }
          } catch (e) {
            console.error('❌ Erro ao processar JSON do Telegram:', e);
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `❌ *Erro de Formato*\nO texto enviado não é um JSON válido.`, parse_mode: 'Markdown' })
            });
          }
        }

        // Se for texto do Telegram, mas não "OK" ou JSON, encerra para não gerar loop
        return c.text('EVENT_RECEIVED', 200);
      }

      // Se for um evento do Telegram (como edições de mensagem ou atualizações de status) que não possui texto, ignoramos silenciosamente para evitar loops de retentativa
      if ('update_id' in body) {
        return c.text('EVENT_RECEIVED', 200);
      }

      const parsed = bioimpedanceSchema.safeParse(body);

      if (!parsed.success) {
        return c.json({ error: "Payload de Bioimpedância inválido.", code: "VALIDATION_ERR", details: parsed.error.format() }, 400);
      }

      const data = parsed.data;
      
      const athlete = await athleteRepository.getPrimaryAthlete();
      if (!athlete) {
        return c.json({ error: "Atleta principal não encontrado no banco.", code: "ATHLETE_NOT_FOUND" }, 404);
      }

      // Previne duplicidade para webhooks diretos
      await db.delete(bioimpedanceLogs).where(
        and(
          eq(bioimpedanceLogs.athleteId, athlete.id),
          eq(bioimpedanceLogs.date, new Date(data.date))
        )
      );

      const insertedLog = await telemetryRepository.insertLog(athlete.id, data);

      return c.json({ data: { message: "Bioimpedância registrada com sucesso.", log: insertedLog } });
    } catch (error) {
      return c.json({ error: "Erro interno no processamento do webhook.", code: "WEBHOOK_ERR" }, 500);
    }
  },

  async handleCron(c: Context) {
    try {
      const authHeader = c.req.header('Authorization') || c.req.header('x-cron-secret');
      const expectedSecret = process.env.TELEGRAM_CRON_SECRET || '12345';
      
      if (authHeader !== expectedSecret) {
        return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
      }

      await runDailyBriefingJob();

      return c.json({ data: { message: "Cron executado e briefing enviado ao Telegram." } });
    } catch (error) {
      return c.json({ error: "Erro interno no processamento do cron.", code: "CRON_ERR" }, 500);
    }
  },

  async handleRecalculate(c: Context) {
    try {
      const authHeader = c.req.header('Authorization') || c.req.header('x-cron-secret');
      const expectedSecret = process.env.TELEGRAM_CRON_SECRET || '12345';
      
      if (authHeader !== expectedSecret) {
        return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
      }

      await runRouteRecalculationJob();
      return c.json({ data: { message: "Cron de Recálculo executado com sucesso." } });
    } catch (error) {
      return c.json({ error: "Erro interno ao executar o recálculo.", code: "CRON_ERR" }, 500);
    }
  }
};