import { Hono } from 'hono';
import { stravaController } from '@/controllers/stravaController';

export const stravaRoutes = new Hono();

// Endpoint único de Webhook: Responde a GET (desafio do Strava) e POST (dados em tempo real)
stravaRoutes.get('/webhook', stravaController.handleWebhook);
stravaRoutes.post('/webhook', stravaController.handleWebhook);