import { Hono } from 'hono';
import { strengthController } from '../controllers/strengthController';

export const strengthRoutes = new Hono();

// Rotas do Laboratório de Força (IronLog)
strengthRoutes.get('/templates', strengthController.listTemplates);
strengthRoutes.get('/templates/:id/exercises', strengthController.getTemplateExercises);
strengthRoutes.post('/log', strengthController.logWorkout);
strengthRoutes.get('/log/:sessionId/audit', strengthController.getAudit);