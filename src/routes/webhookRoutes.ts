import { Hono } from 'hono';
import { webhookController } from '@/controllers/webhookController';

export const webhookRoutes = new Hono();

// Quando bater POST em /api/webhooks/uptime, chama o controller
webhookRoutes.post('/uptime', webhookController.toggleUptime);
