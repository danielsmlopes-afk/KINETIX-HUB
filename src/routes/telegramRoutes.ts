import { Hono } from 'hono';
import { telegramController } from '@/controllers/telegramController';

export const telegramRoutes = new Hono();

telegramRoutes.post('/webhook', telegramController.handleWebhook);