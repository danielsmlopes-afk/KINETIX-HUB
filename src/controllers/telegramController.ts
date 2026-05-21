// Arquivo: src/controllers/telegramController.ts
import { Context } from 'hono';
import { z } from 'zod';
import { telemetryRepository } from '@/repositories/telemetryRepository';

const telemetrySchema = z.object({
  athleteId: z.string().uuid(),
  peso: z.number().positive(),
  gordura: z.number().positive(),
  agua: z.number().positive().optional(),
  massaMuscular: z.number().positive().optional(),
  tmb: z.number().positive(),
});

export const telegramController = {
  async handleWebhook(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = telemetrySchema.safeParse(body);

      if (!parsed.success) {
        return c.json({ error: "Payload de telemetria inválido.", code: "VALIDATION_ERR", details: parsed.error.format() }, 400);
      }

      const data = parsed.data;
      const log = await telemetryRepository.insertLog({ athleteId: data.athleteId, weightKg: data.peso, bodyFatPercentage: data.gordura, bmr: data.tmb });

      return c.json({ data: { message: "Bioimpedância registrada com sucesso.", log } });
    } catch (error) {
      return c.json({ error: "Erro interno no processamento do webhook.", code: "WEBHOOK_ERR" }, 400);
    }
  }
};