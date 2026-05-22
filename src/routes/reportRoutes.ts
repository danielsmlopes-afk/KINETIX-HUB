// Arquivo: src/routes/reportRoutes.ts
import { Hono } from 'hono';
import { reportController } from '@/controllers/reportController';

export const reportRoutes = new Hono();

reportRoutes.get('/xray/:month/:year', reportController.downloadXRay);
reportRoutes.get('/race/:raceId', reportController.downloadRaceReport);
reportRoutes.get('/career', reportController.downloadCareerReport);
reportRoutes.get('/plan', reportController.downloadPlanReport);