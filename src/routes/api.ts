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
// IMPORT NOVO DO WEBHOOK (Verifique se a exportação lá está como default ou nomeada)
import { webhookRoutes } from '@/routes/webhookRoutes'; 

export const apiRoutes = new Hono();

// 🟢 Rota de Health Check para o Render
apiRoutes.get('/healthz', (c) => {
  return c.json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString() 
  }, 200);
});

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
// 🔌 PLUGANDO A NOVA ROTA DO CRON-JOB.ORG AQUI
apiRoutes.route('/webhooks', webhookRoutes); 
