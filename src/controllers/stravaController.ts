import { Context } from 'hono';
import { env } from '@/config/env';
import { coachService } from '@/services/coachService';
import { workoutService } from '@/services/workoutService';
import { athleteRepository } from '@/repositories/athleteRepository';
import { db } from '@/db';
import { plannedWorkouts } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { StravaService } from '@/services/stravaService';
import { telegramMessageService } from '@/services/telegramMessageService';

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

    const spDateStr = activityDate.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    
    const plannedList = await db.select().from(plannedWorkouts).where(
      and(
        eq(plannedWorkouts.athleteId, athlete.id),
        sql`DATE(${plannedWorkouts.date}) = ${spDateStr}`
      )
    );

    const plannedRun = plannedList.find(p => p.activityType === 'RUN' || p.activityType === 'RUN_INTERVAL');

    if (!plannedRun) {
      console.log(`[Strava] Nenhuma corrida planejada encontrada para ${spDateStr}. Atividade registrada como Treino Livre.`);
      return;
    }

    const details = plannedRun.details as any;
    let targetDistanceKm = 0;
    let targetPaceStr = '';

    if (details && typeof details.corrida === 'string') {
      const distMatch = details.corrida.match(/([\d.,]+)\s*km/i);
      if (distMatch) targetDistanceKm = parseFloat(distMatch[1].replace(',', '.'));
      
      const paceMatch = details.corrida.match(/@\s*(\d{1,2}:\d{2})/);
      if (paceMatch) targetPaceStr = paceMatch[1];
    }

    // Delegação para o novo Protocolo de Esteira Calibrada (V2)
    const auditResult = await coachService.auditWorkout(
      activity as any,
      plannedRun.id,
      targetDistanceKm,
      targetPaceStr
    );

    // 🚨 Notificação instantânea da Auditoria no Telegram com o Motivo
    let statusEmoji = '✅';
    if (auditResult.complianceStatus === 'PARTIAL') statusEmoji = '⚠️';
    else if (auditResult.complianceStatus === 'COMPLETED_NOT_VALIDATED') statusEmoji = '❌';

    const auditMsg = `🏃‍♂️ *AUDITORIA DE COMBATE (STRAVA)* 🏃‍♂️\n\n` +
      `*Missão:* ${activity.name}\n` +
      `*Distância:* ${distanceKm}km\n` +
      `*Pace Médio:* ${paceMins}:${paceSecs}/km\n` +
      `*Status:* ${statusEmoji} ${auditResult.complianceStatus}\n\n` +
      `*Parecer do Head Coach:*\n_${auditResult.feedback}_`;

    await telegramMessageService.sendSimpleMessage(Number(env.TELEGRAM_CHAT_ID), auditMsg);

    // Gatilho imediato do Digital Twin para Longões (>= 4.9km)
    if (distanceKm >= 4.9) {
      console.log(`[Strava] Gatilho imediato do Digital Twin acionado para o longão de ${distanceKm}km.`);
      const stravaSvc = new StravaService();
      stravaSvc.scanAndLogEnduranceRun().catch(console.error);
    }
  }
};