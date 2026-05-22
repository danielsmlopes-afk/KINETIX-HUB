// Arquivo: src/routes/telegramRoutes.ts
import { Hono } from 'hono';
import { telegramController } from '@/controllers/telegramController';

export const telegramRoutes = new Hono();

// Mapeia a rota do webhook para o método do controller
telegramRoutes.post('/webhook', telegramController.handleWebhook);