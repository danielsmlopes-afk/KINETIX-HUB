// Arquivo: src/routes/api.ts
import { Hono } from 'hono';
import { athleteController } from '@/controllers/athleteController';
import { telegramController } from '@/controllers/telegramController';
import { reportRoutes } from '@/routes/reportRoutes';
import { stravaRoutes } from '@/routes/stravaRoutes';
import { strengthRoutes } from '@/routes/strengthRoutes';
import racesRouter from '@/routes/races';
import { importRoutes } from '@/routes/importRoutes';
import { coachRoutes } from '@/routes/coachRoutes';
import { webhookRoutes } from '@/routes/webhookRoutes';
import { gearRoutes } from '@/routes/gearRoutes';
import { firebaseAuthMiddleware } from '@/config/authMiddleware';

export const apiRoutes = new Hono();

// Grupo de rotas privadas do App (requer Firebase Auth)
const privateAppRoutes = new Hono();
privateAppRoutes.use('*', firebaseAuthMiddleware);
privateAppRoutes.get('/athlete/profile', athleteController.getProfile);
privateAppRoutes.route('/reports', reportRoutes);
privateAppRoutes.route('/strength', strengthRoutes);
privateAppRoutes.route('/races', racesRouter);
privateAppRoutes.route('/import', importRoutes);
privateAppRoutes.route('/coach', coachRoutes);
privateAppRoutes.route('/gear', gearRoutes);

// Monta o grupo protegido na API
apiRoutes.route('/', privateAppRoutes);

// Rotas públicas (Webhooks, Cron, Strava OAuth)
apiRoutes.post('/webhook/telegram', telegramController.handleWebhook);
apiRoutes.get('/cron/daily', telegramController.handleCron);
apiRoutes.get('/cron/recalculate', telegramController.handleRecalculate);
apiRoutes.route('/strava', stravaRoutes);
apiRoutes.route('/', webhookRoutes);