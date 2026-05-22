// Arquivo: src/controllers/telegramController.ts
import { Context } from 'hono';
import { z } from 'zod';
import { telemetryRepository } from '@/repositories/telemetryRepository';
import { athleteRepository } from '@/repositories/athleteRepository';
import { runDailyBriefingJob } from '@/services/cronJobs';

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
      const parsed = bioimpedanceSchema.safeParse(body);

      if (!parsed.success) {
        return c.json({ error: "Payload de Bioimpedância inválido.", code: "VALIDATION_ERR", details: parsed.error.format() }, 400);
      }

      const data = parsed.data;
      
      const athlete = await athleteRepository.getPrimaryAthlete();
      if (!athlete) {
        return c.json({ error: "Atleta principal não encontrado no banco.", code: "ATHLETE_NOT_FOUND" }, 404);
      }

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
  }
};