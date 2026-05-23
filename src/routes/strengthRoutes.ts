import { Hono } from 'hono';
import { strengthController } from '../controllers/strengthController';

export const strengthRoutes = new Hono();

strengthRoutes.get('/templates', strengthController.listTemplates);
strengthRoutes.get('/templates/:id/exercises', strengthController.getTemplateExercises);
strengthRoutes.post('/log', strengthController.logWorkout);
strengthRoutes.get('/audit/:sessionId', strengthController.getAudit);