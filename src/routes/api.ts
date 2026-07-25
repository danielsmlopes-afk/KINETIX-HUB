// Arquivo: src/routes/api.ts
import { Hono } from 'hono';
import { athleteController } from '@/controllers/athleteController';
import { telegramController } from '@/controllers/telegramController';
import { stravaRoutes } from '@/routes/stravaRoutes';
import { strengthRoutes } from '@/routes/strengthRoutes';
import racesRouter from '@/routes/races';
import { importRoutes } from '@/routes/importRoutes';
import { coachRoutes } from '@/routes/coachRoutes';
import { gearRoutes } from '@/routes/gearRoutes';
import { firebaseAuthMiddleware } from '@/config/authMiddleware';
import { dossierController } from '@/controllers/dossierController';
import { webhookRoutes } from '@/routes/webhookRoutes';
import { debugRoutes } from '@/routes/debugRoutes';
import { dossierRoutes } from '@/routes/dossierRoutes';
import { workoutRoutes } from '@/routes/workoutRoutes';
import hallOfFameRoutes from '@/routes/hallOfFameRoutes';
import { encyclopediaRoutes } from '@/routes/encyclopediaRoutes';
import { nutritionRoutes } from '@/routes/nutritionRoutes';

export const apiRoutes = new Hono();

// ============================================================================
// 1. MÓDULO DE AUTOMAÇÃO E TELEMETRIA (Protegidas por Secrets Internos)
// ============================================================================
apiRoutes.post('/webhook/telegram', telegramController.handleWebhook);
apiRoutes.get('/cron/daily', telegramController.handleCron);
apiRoutes.get('/cron/recalculate', telegramController.handleRecalculate);
apiRoutes.route('/strava', stravaRoutes);
apiRoutes.route('/webhook', webhookRoutes);
apiRoutes.route('/debug', debugRoutes);

// ============================================================================
// 2. MÓDULO DE DOSSIÊS (Autenticação Híbrida: Header ou Query ?token=)
// ============================================================================
// As antigas rotas /reports foram removidas (Limpeza de PDFs).

// ============================================================================
// 3. MÓDULO CORE - APP MOBILE (Proteção Estrita via Header Bearer Token)
// ============================================================================
const privateAppRoutes = new Hono();
privateAppRoutes.use('*', firebaseAuthMiddleware);

// 3.1 Identidade e Perfil Clínica
privateAppRoutes.get('/athlete/profile', athleteController.getProfile);
privateAppRoutes.get('/athlete/bioimpedance-history', athleteController.getBioimpedanceHistory);
privateAppRoutes.get('/athlete/dossier', dossierController.getDossier);

// 3.2 Sub-Roteadores de Domínio Tático
privateAppRoutes.route('/strength', strengthRoutes);
privateAppRoutes.route('/races', racesRouter);
privateAppRoutes.route('/import', importRoutes);
privateAppRoutes.route('/coach', coachRoutes);
privateAppRoutes.route('/gear', gearRoutes);
privateAppRoutes.route('/dossiers', dossierRoutes);
privateAppRoutes.route('/workouts', workoutRoutes);
privateAppRoutes.route('/hall-of-fame', hallOfFameRoutes);
privateAppRoutes.route('/encyclopedia', encyclopediaRoutes);
privateAppRoutes.route('/nutrition', nutritionRoutes);

// Monta o grupo protegido na API depois das rotas livres
apiRoutes.route('/', privateAppRoutes);
