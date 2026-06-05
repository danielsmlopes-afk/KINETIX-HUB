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
webhookRoutes.post('/digital-twin', webhookController.triggerDigitalTwin);
webhookRoutes.post('/route-recalculation', webhookController.triggerRouteRecalculation);
webhookRoutes.post('/carb-loading', webhookController.triggerCarbLoading);
webhookRoutes.post('/joint-checkin', webhookController.triggerJointCheckin);
webhookRoutes.post('/sunday-sync', webhookController.handleSundaySync);

// Fallback de segurança: Impede que requisições GET ou erradas
// "vazem" para o middleware do Firebase no api.ts
webhookRoutes.all('/*', (c) => {
  return c.json({ error: 'Método HTTP não permitido nesta rota. Use POST.', code: 'METHOD_NOT_ALLOWED' }, 405);
});
