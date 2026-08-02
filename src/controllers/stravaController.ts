import { Context } from 'hono';
import { env } from '@/config/env';
import { coachService } from '@/services/coachService';
import { workoutService } from '@/services/workoutService';
import { athleteRepository } from '@/repositories/athleteRepository';
import { db } from '@/db';
import { plannedWorkouts } from '@/db/schema';
import { and, eq, sql, inArray } from 'drizzle-orm';
import { StravaService, StravaActivity } from '@/services/stravaService';
import { telegramMessageService } from '@/services/telegramMessageService';
import { redisClient } from '@/config/redis';

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
  async historicalSync(c: Context) {
    // Rota dummy para evitar erro 404 no frontend mantendo a interface silenciosa
    return c.json({ data: { message: 'Sincronização histórica já processada (Motor Passivo).' } }, 200);
  },

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
    // Portão de Entrada Tático: Array de modalidades permitidas para processamento.
    const allowedTypes = ['Run', 'VirtualRun', 'Ride', 'VirtualRide', 'WeightTraining', 'Workout'];
    
    // Log inicial para rastreabilidade
    console.log(`[Strava] Recebido gatilho para atividade ${activityId}. Iniciando extração de telemetria...`);
    
    const athlete = await athleteRepository.getPrimaryAthlete();
    if (!athlete) {
      console.error('[Strava] Operação abortada: Atleta principal não encontrado.');
      return;
    }

    let tokenData: { access_token: string };
    let activity: Record<string, unknown>;

    try {
      const tokenRes = await fetch('https://www.strava.com/api/v3/oauth/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, refresh_token: env.STRAVA_REFRESH_TOKEN, grant_type: 'refresh_token' })
      });
      if (!tokenRes.ok) throw new Error(`Token endpoint HTTP ${tokenRes.status}`);
      tokenData = await tokenRes.json() as { access_token: string };
      if (!tokenData.access_token) throw new Error('Token ausente no payload.');
    } catch (error) {
      console.error('❌ [Strava] API Indisponível (Falha ao obter Access Token):', error);
      return;
    }

    try {
      const activityRes = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (!activityRes.ok) throw new Error(`Activity endpoint HTTP ${activityRes.status}`);
      activity = await activityRes.json() as Record<string, unknown>;
    } catch (error) {
      console.error(`❌ [Strava] API Indisponível (Falha ao buscar Atividade ${activityId}):`, error);
      return;
    }

    if (!allowedTypes.includes(String(activity.type))) {
      console.log(`[Strava] Operação ignorada. Tipo de atividade não monitorado: ${activity.type}.`);
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
    workoutService.processStravaActivity(athlete.id, activity as unknown as StravaActivity).catch(err => {
      console.error('❌ [Strava] Erro ao processar logística de Arsenal/Géis:', err);
    });

    const distanceKm = Number((Number(activity.distance) / 1000).toFixed(2));
    const movingTimeSeconds = Number(activity.moving_time);
    const paceMins = Math.floor((movingTimeSeconds / 60) / distanceKm);
    const paceSecs = Math.floor(((movingTimeSeconds / 60) / distanceKm % 1) * 60).toString().padStart(2, '0');

    const spDateStr = activityDate.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    
    // 1. Conversor de Modalidade (Strava -> Kinetix Domain)
    let expectedType = 'RUN';
    const currentType = String(activity.type);

    if (['Ride', 'VirtualRide', 'GravelRide', 'EBikeRide'].includes(currentType)) {
      expectedType = 'BIKE';
    } else if (['WeightTraining', 'Workout', 'Crossfit'].includes(currentType)) {
      expectedType = 'STRENGTH';
    }

    const expectedTypes = expectedType === 'RUN' ? ['RUN', 'RUN_INTERVAL'] : [expectedType];

    // 2. Refatoração da Query no Drizzle para incluir o Filtro Tático de Modalidade
    const plannedList = await db.select().from(plannedWorkouts).where(
      and(
        eq(plannedWorkouts.athleteId, athlete.id),
        sql`DATE(${plannedWorkouts.date}) = ${spDateStr}`,
        inArray(plannedWorkouts.activityType, expectedTypes)
      )
    ).limit(1);

    const plannedWorkout = plannedList[0];

    if (!plannedWorkout) {
      console.log(`[Strava] Nenhum treino de ${expectedType} planejado para ${spDateStr}. Atividade registrada como Treino Livre.`);
      return;
    }

    const details = plannedWorkout.details as { corrida?: string, bike?: string, academia?: string };
    let targetDistanceKm = 0;
    let targetPaceStr = '';

    if (details && typeof details.corrida === 'string') {
      const parts = details.corrida.split('|').map(s => s.trim());
      if (parts.length > 0) {
        const distMatch = parts[0].match(/([\d.,]+)\s*km/i);
        if (distMatch) targetDistanceKm = parseFloat(distMatch[1].replace(',', '.'));
      }
      if (parts.length > 1) {
        targetPaceStr = parts[1];
      }
    }

    // 🚨 FILTRO INTELIGENTE: Blindagem contra Sequestro de Validação 🚨
    if (expectedType === 'RUN') {
      // Regra 1: Caminhadas são barradas de validar treinos de corrida moderados/longos
      if (['Walk', 'Hike'].includes(currentType) && targetDistanceKm >= 5) {
        console.log(`[Strava] Caminhada detectada (${distanceKm}km). Ignorando validação da corrida principal (${targetDistanceKm}km).`);
        return;
      }
      // Regra 2: Corridas muito curtas (<3.5km) não validam metas longas (>=5km)
      if (distanceKm <= 3.5 && targetDistanceKm >= 5) {
        console.log(`[Strava] Aquecimento/Soltura detectado (${distanceKm}km). Ignorando validação do treino principal (${targetDistanceKm}km).`);
        return;
      }
    }

    let auditResult = { complianceStatus: 'COMPLETED_NOT_VALIDATED', feedback: 'Auditoria não realizada.' };
    try {
      // Delegação para o novo Protocolo de Esteira Calibrada (V2)
      auditResult = await coachService.auditWorkout(
        activity as unknown as StravaActivity,
        plannedWorkout.id,
        targetDistanceKm,
        targetPaceStr
      );
    } catch (error) {
      console.error('❌ [Strava] Erro fatal durante auditoria via Head Coach:', error);
      auditResult.feedback = 'Falha sistêmica durante a auditoria (Motor Cognitivo/DB).';
    }

    // 🚨 Notificação instantânea da Auditoria no Telegram com Circuit Breaker
    try {
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
    } catch (error) {
      console.error('❌ [Strava] Falha de comunicação com o Telegram (Notificação de Auditoria):', error);
    }

    // Gatilho imediato do Digital Twin para Longões (>= 4.9km)
    if (distanceKm >= 4.9) {
      console.log(`[Strava] Gatilho imediato do Digital Twin acionado para o longão de ${distanceKm}km.`);
      const stravaSvc = new StravaService();
      stravaSvc.scanAndLogEnduranceRun().catch(console.error);
    }

    // Invalida o cache do Dashboard para refletir o novo treino sincronizado imediatamente
    if (redisClient) await redisClient.del(`dashboard:profile:${athlete.id}`);
  }
};
