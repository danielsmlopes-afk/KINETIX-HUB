import { Hono } from 'hono';
import { webhookController } from '@/controllers/webhookController';

export const webhookRoutes = new Hono();

webhookRoutes.post('/uptime', webhookController.toggleUptime);
webhookRoutes.post('/weather-pacing', webhookController.handleWeatherPacing);
webhookRoutes.post('/acwr-audit', webhookController.handleAcwrAudit);
webhookRoutes.post('/db-maintenance', webhookController.handleDbMaintenance);
webhookRoutes.post('/manual-trigger', webhookController.handleManualTrigger);
webhookRoutes.post('/weekly-report', webhookController.triggerWeeklyReport);
webhookRoutes.post('/monthly-report', webhookController.triggerMonthlyReport);
webhookRoutes.post('/race-briefing', webhookController.triggerRaceBriefing);
