import { Context } from 'hono';
import { env } from '@/config/env';
import { toggleMonitor } from '@/services/uptimeService';
import { acwrService } from '@/services/acwrService';
import { dbMaintenanceService } from '@/services/dbMaintenanceService';
import { weatherPacingService } from '@/services/weatherPacingService';
import { morningRaceService } from '@/services/morningRaceService';
import { briefingService } from '@/services/briefingService';
import { webhookService } from '@/services/webhookService';

const isAuth = (c: Context) => c.req.header('x-cron-secret') === env.CRON_SECRET;
const authError = (c: Context) => c.json({ error: 'Unauthorized', code: 'AUTH_FAILED' }, 401);

export const webhookController = {
  toggleUptime: async (c: Context) => {
    if (!isAuth(c)) return authError(c);
    try {
      const { status } = await c.req.json().catch(() => ({}));
      if (status === 0 || status === 1) await toggleMonitor(status);
      return c.json({ data: { message: `Comando processado com status: ${status}` } }, 200);
    } catch (error) {
      return c.json({ error: 'Erro ao processar webhook', code: 'INTERNAL_ERROR' }, 500);
    }
  },

  handleWeatherPacing: async (c: Context) => {
    if (!isAuth(c)) return authError(c);
    try {
      await weatherPacingService.checkUpcomingRaces();
      return c.json({ data: { message: 'OK' } }, 200);
    } catch (error) {
      return c.json({ error: 'Erro de processamento', code: 'WEATHER_PACING_ERR' }, 500);
    }
  },

  handleAcwrAudit: async (c: Context) => {
    if (!isAuth(c)) return authError(c);
    try {
      await acwrService.calculateWeeklyFatigue();
      return c.json({ data: { message: 'OK' } }, 200);
    } catch (error) {
      return c.json({ error: 'Erro interno', code: 'ACWR_AUDIT_ERR' }, 500);
    }
  },

  handleDbMaintenance: async (c: Context) => {
    if (!isAuth(c)) return authError(c);
    try {
      await dbMaintenanceService.runMaintenanceTasks();
      return c.json({ data: { message: 'OK' } }, 200);
    } catch (error) {
      return c.json({ error: 'Erro', code: 'DB_MAINTENANCE_ERR' }, 500);
    }
  },

  handleManualTrigger: async (c: Context) => {
    if (!isAuth(c)) return authError(c);
    try {
      const { jobId } = await c.req.json() as { jobId?: string };
      switch (jobId) {
        case 'MORNING_RACE':
          await morningRaceService.executeMorningRoutines();
          break;
        case 'DAILY_BRIEFING':
          await briefingService.executeBriefing();
          break;
        default:
          return c.json({ error: 'JobId inválido ou não suportado.', code: 'BAD_REQUEST' }, 400);
      }
      return c.json({ data: { message: `Gatilho ${jobId} executado.` } }, 200);
    } catch (error) {
      return c.json({ error: 'Falha', code: 'MANUAL_TRIGGER_ERR' }, 500);
    }
  },

  triggerWeeklyReport: async (c: Context) => {
    if (!isAuth(c)) return authError(c);
    webhookService.processWeeklyReport().catch(e => console.error('[Webhook] WeeklyReport Erro:', e));
    return c.text('OK', 200);
  },

  triggerMonthlyReport: async (c: Context) => {
    if (!isAuth(c)) return authError(c);
    webhookService.processMonthlyReport().catch(e => console.error('[Webhook] MonthlyReport Erro:', e));
    return c.text('OK', 200);
  },

  triggerRaceBriefing: async (c: Context) => {
    if (!isAuth(c)) return authError(c);
    let raceId = 'SP-21K';
    try { const body = await c.req.json(); if (body?.raceId) raceId = body.raceId; } catch {}
    webhookService.processRaceBriefing(raceId).catch(e => console.error('[Webhook] RaceBriefing Erro:', e));
    return c.text('OK', 200);
  },

  triggerDigitalTwin: async (c: Context) => {
    if (!isAuth(c)) return authError(c);
    webhookService.processDigitalTwin().catch(e => console.error('[Webhook] DigitalTwin Erro:', e));
    return c.text('OK', 200);
  },

  triggerRouteRecalculation: async (c: Context) => {
    if (!isAuth(c)) return authError(c);
    webhookService.processRouteRecalculation().catch(e => console.error('[Webhook] Recalculation Erro:', e));
    return c.text('OK', 200);
  },

  triggerCarbLoading: async (c: Context) => {
    if (!isAuth(c)) return authError(c);
    webhookService.processCarbLoading().catch(e => console.error('[Webhook] CarbLoading Erro:', e));
    return c.text('OK', 200);
  },

  triggerJointCheckin: async (c: Context) => {
    if (!isAuth(c)) return authError(c);
    webhookService.processJointCheckin().catch(e => console.error('[Webhook] JointCheckin Erro:', e));
    return c.text('OK', 200);
  },

  handleSundaySync: async (c: Context) => {
    if (!isAuth(c)) return authError(c);
    try {
      const { syncedCount } = await webhookService.processSundaySync();
      return c.json({ data: { message: 'Sunday Sync executado com sucesso.', syncedRaces: syncedCount } }, 200);
    } catch (error: any) {
      return c.json({ error: 'Falha no webhook dominical', details: error.message }, 500);
    }
  }
};
