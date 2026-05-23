import { Hono } from 'hono';
import { webhookController } from '@/controllers/webhookController';

export const webhookRoutes = new Hono();

// Quando bater POST em /api/webhooks/uptime, chama o controller
webhookRoutes.post('/uptime', webhookController.toggleUptime);
webhookRoutes.post('/weather-pacing', webhookController.handleWeatherPacing);
webhookRoutes.post('/performance/acwr', webhookController.handleAcwrAudit);
webhookRoutes.post('/db-maintenance', webhookController.handleDbMaintenance);
