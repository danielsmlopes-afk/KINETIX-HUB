import { Context } from 'hono';
import { z } from 'zod';
import { StravaService } from '../services/stravaService';
import { stravaRepository } from '../repositories/stravaRepository';
import { athleteRepository } from '../repositories/athleteRepository';
import { env } from '../config/env';
import { workoutService } from '../services/workoutService';

const stravaService = new StravaService();

const stravaWebhookSchema = z.object({
  object_type: z.string(),
  aspect_type: z.string(),
  object_id: z.number(),
  owner_id: z.number(),
  updates: z.record(z.any()).optional(),
}).passthrough();

export const stravaController = {
  login: async (c: Context) => {
    const authUrl = stravaService.getAuthUrl();
    return c.redirect(authUrl);
  },

  callback: async (c: Context) => {
    const code = c.req.query('code');
    const error = c.req.query('error');

    if (error) {
      return c.json({ error: 'Autorização negada pelo usuário.', code: 'STRAVA_AUTH_DENIED' }, 400);
    }

    if (!code) {
      return c.json({ error: 'Código de autorização ausente.', code: 'STRAVA_AUTH_NO_CODE' }, 400);
    }

    try {
      const tokenData = await stravaService.exchangeToken(code);
      
      const athlete = await athleteRepository.getPrimaryAthlete();
      if (!athlete) {
        return c.json({ error: 'Atleta principal não encontrado.', code: 'ATHLETE_NOT_FOUND' }, 404);
      }

      await stravaRepository.saveTokens(
        athlete.id,
        tokenData.access_token,
        tokenData.refresh_token,
        tokenData.expires_at
      );

      return c.json({ 
        data: {
          message: 'Autenticação com Strava realizada com sucesso!',
          athleteId: athlete.id
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido durante a autenticação.';
      return c.json({ error: errorMessage, code: 'STRAVA_TOKEN_EXCHANGE_ERROR' }, 500);
    }
  },

  verifyWebhook: async (c: Context) => {
    const mode = c.req.query('hub.mode');
    const token = c.req.query('hub.verify_token');
    const challenge = c.req.query('hub.challenge');

    if (mode === 'subscribe' && token === env.STRAVA_VERIFY_TOKEN) {
      console.log('✅ Webhook do Strava verificado com sucesso!');
      return c.json({ 'hub.challenge': challenge });
    }
    return c.json({ error: 'Token de verificação inválido', code: 'FORBIDDEN' }, 403);
  },

  handleWebhook: async (c: Context) => {
    try {
      const rawBody = await c.req.json().catch(() => ({}));
      const parsed = stravaWebhookSchema.safeParse(rawBody);
      
      if (!parsed.success) {
        return c.text('EVENT_RECEIVED', 200); // Ignora silenciosamente para não travar o Strava
      }

      const { object_type, aspect_type, object_id } = parsed.data;
      
      if (object_type === 'activity' && aspect_type === 'create') {
        athleteRepository.getPrimaryAthlete().then(async (athlete) => {
          if (!athlete) return;
          const activity = await stravaService.getActivityDetails(athlete.id, object_id);
          console.log(`\n🏃‍♂️ NOVA ATIVIDADE BAIXADA!`);
          console.log(`Título: ${activity.name} | Distância: ${activity.distance}m | Equipamento: ${activity.gear_id || 'Nenhum'}\n`);
          await workoutService.processStravaActivity(athlete.id, activity);
        }).catch(err => console.error('Erro no processamento do webhook:', err.message));
      }

      return c.text('EVENT_RECEIVED', 200); // O Strava exige um status 200 para confirmar o recebimento
    } catch (error) {
      return c.json({ error: 'Erro interno ao processar webhook', code: 'WEBHOOK_ERR' }, 500);
    }
  }
};