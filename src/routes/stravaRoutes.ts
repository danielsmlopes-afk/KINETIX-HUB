import { Hono } from 'hono';
import { stravaController } from '@/controllers/stravaController';

export const stravaRoutes = new Hono();

// Rota dummy para sincronização histórica (evita 404 Not Found no app mobile)
stravaRoutes.post('/historical-sync', stravaController.historicalSync);

// Endpoint único de Webhook: Responde a GET (desafio do Strava) e POST (dados em tempo real)
stravaRoutes.get('/webhook', stravaController.handleWebhook);
stravaRoutes.post('/webhook', stravaController.handleWebhook);