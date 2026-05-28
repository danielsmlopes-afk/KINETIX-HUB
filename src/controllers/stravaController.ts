import { Context } from 'hono';
import { env } from '@/config/env';
import { coachService } from '@/services/coachService';
import { workoutService } from '@/services/workoutService';
import { athleteRepository } from '@/repositories/athleteRepository';

type StravaWebhookPayload = {
  'hub.mode'?: string;
  'hub.verify_token'?: string;
  'hub.challenge'?: string;
  object_type?: string;
  aspect_type?: string;
  object_id?: number;
  [key: string]: unknown;
};

export const stravaController = {
  async handleWebhook(c: Context) {
    try {
      // 1. Verificação de Assinatura do Webhook (Requisição GET)
      if (c.req.method === 'GET') {
        const mode = c.req.query('hub.mode');
        const token = c.req.query('hub.verify_token');
        const challenge = c.req.query('hub.challenge');
        if (mode === 'subscribe' && token === env.STRAVA_VERIFY_TOKEN) {
          return c.json({ 'hub.challenge': challenge });
        }
        return c.text('Forbidden', 403);
      }

      // 2. Processamento de Eventos em Tempo Real (Requisição POST)
      const body = await c.req.json<StravaWebhookPayload>().catch(() => ({} as StravaWebhookPayload));

      if (body.object_type === 'activity' && body.aspect_type === 'create') {
        const activityId = body.object_id;
        
        if (activityId) {
          // Desacoplamento Tático: Inicia o job em background e libera a API
          setTimeout(() => stravaController.processActivity(activityId).catch(console.error), 0);
        }
      }

      // Retorno Imediato Obrigatório para o Strava
      return c.text('OK', 200);
    } catch (error) {
      console.error('❌ [Strava] Erro fatal no controlador do Webhook:', error);
      return c.text('OK', 200);
    }
  },

  async processActivity(activityId: number): Promise<void> {
    console.log(`[Strava] Extraindo telemetria da atividade ${activityId}...`);
    
    const athlete = await athleteRepository.getPrimaryAthlete();
    if (!athlete) {
      console.error('[Strava] Operação abortada: Atleta principal não encontrado.');
      return;
    }

    const tokenRes = await fetch('https://www.strava.com/api/v3/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, refresh_token: env.STRAVA_REFRESH_TOKEN, grant_type: 'refresh_token' })
    });
    
    const tokenData = await tokenRes.json() as { access_token: string };
    if (!tokenData.access_token) throw new Error('Falha ao obter Access Token.');

    const activityRes = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    
    if (!activityRes.ok) throw new Error(`API do Strava rejeitou requisição: ${activityRes.status}`);
    const activity = await activityRes.json() as Record<string, unknown>;

    if (activity.type !== 'Run') {
      console.log(`[Strava] Operação ignorada. Atividade não é corrida (Tipo: ${activity.type}).`);
      return;
    }

    // BLINDAGEM DO MOTOR: Ignora atividades antigas para evitar recálculo tático de rota
    const activityDate = new Date(String(activity.start_date));
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 1); // Tolerância de 1 dia para sync atrasado
    limitDate.setHours(0, 0, 0, 0);

    if (activityDate.getTime() < limitDate.getTime()) {
      console.log(`[Strava] Operação ignorada. Atividade ocorreu no passado (${activityDate.toLocaleDateString('pt-BR')}). Evitando falsos-positivos na auditoria.`);
      return;
    }

    // DESPACHANTE LOGÍSTICO (NÃO-BLOQUEANTE): Dedução de Arsenal (Tênis) e Estoque (Géis)
    workoutService.processStravaActivity(athlete.id, activity as any).catch(err => {
      console.error('❌ [Strava] Erro ao processar logística de Arsenal/Géis:', err);
    });

    const distanceKm = Number((Number(activity.distance) / 1000).toFixed(2));
    const movingTimeSeconds = Number(activity.moving_time);
    const paceMins = Math.floor((movingTimeSeconds / 60) / distanceKm);
    const paceSecs = Math.floor(((movingTimeSeconds / 60) / distanceKm % 1) * 60).toString().padStart(2, '0');

        // Verifica presença de traçado GPS e flag de ambiente indoor (trainer)
        const mapData = activity.map as { summary_polyline?: string } | undefined;
        const hasGps = Boolean(mapData && mapData.summary_polyline);
        const isTrainer = Boolean(activity.trainer);
        
        // Capturando Laps (parciais da esteira ou autolaps)
        const laps = Array.isArray(activity.laps) 
          ? activity.laps.map((lap: any) => ({
              distanceMeters: Number(lap.distance || 0),
              movingTimeSeconds: Number(lap.moving_time || 0)
            }))
          : undefined;

        await coachService.analyzeRunActivity({ 
          id: activityId, 
          name: String(activity.name), 
          distanceKm, 
          movingTimeSeconds, 
          paceStr: `${paceMins}:${paceSecs}`, 
          elevationGain: Number(activity.total_elevation_gain || 0),
          hasGps,
          isTrainer,
          laps
        });
  }
};