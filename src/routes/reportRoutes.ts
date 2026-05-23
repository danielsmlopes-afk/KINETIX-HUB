// Arquivo: src/routes/reportRoutes.ts
import { Hono } from 'hono';
import { reportController } from '@/controllers/reportController';

export const reportRoutes = new Hono();

reportRoutes.get('/list', reportController.listReports);
reportRoutes.get('/xray/:month/:year', reportController.downloadXRay);
reportRoutes.get('/race/:raceId', reportController.downloadRaceReport);
reportRoutes.get('/career', reportController.downloadCareerReport);
reportRoutes.get('/plan', reportController.downloadPlanReport);
reportRoutes.get('/logbook/:cycleId', reportController.downloadLogbook);
reportRoutes.get('/history', reportController.downloadCareerHistory);
reportRoutes.get('/briefing/:raceId', reportController.downloadRaceBriefing);
reportRoutes.get('/cardio/:month', reportController.downloadCardioReport);
reportRoutes.get('/strength-audit/:sessionId', reportController.downloadStrengthAudit);