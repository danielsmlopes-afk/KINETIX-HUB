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

export const apiRoutes = new Hono();

// Mapeamento de rotas
apiRoutes.get('/athlete', athleteController.getProfile);
apiRoutes.post('/webhook/telegram', telegramController.handleWebhook);
apiRoutes.get('/cron/daily', telegramController.handleCron);
apiRoutes.get('/cron/recalculate', telegramController.handleRecalculate);
apiRoutes.route('/reports', reportRoutes);
apiRoutes.route('/strava', stravaRoutes);
apiRoutes.route('/strength', strengthRoutes);
apiRoutes.route('/races', racesRouter);
apiRoutes.route('/import', importRoutes);
apiRoutes.route('/coach', coachRoutes);