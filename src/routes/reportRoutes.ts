import { Hono } from 'hono';
import { reportController } from '../controllers/reportController';

export const reportRoutes = new Hono();

// Endpoints dinâmicos consumidos diretamente pelo "reports_screen.dart" (Motor Vetorial)
reportRoutes.get('/logbook/:cycleId', reportController.downloadLogbook);
reportRoutes.get('/career/me', reportController.downloadCareerHistory);
reportRoutes.get('/race/next', reportController.downloadRaceBriefing);
reportRoutes.get('/cardio/current', reportController.downloadCardioReport);
reportRoutes.get('/strength-audit/:sessionId', reportController.downloadStrengthAudit);

// Rotas de legados / relatórios estendidos
reportRoutes.get('/xray/:month/:year', reportController.downloadXRay);
reportRoutes.get('/race/:raceId', reportController.downloadRaceReport);
reportRoutes.get('/career', reportController.downloadCareerReport);
reportRoutes.get('/plan', reportController.downloadPlanReport);