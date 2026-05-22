import { Hono } from 'hono';
import { headCoachController } from '@/controllers/headCoachController';

export const coachRoutes = new Hono();

// Fase 7: Head Coach IA - Consultoria e Recálculo de Rota
coachRoutes.post('/advice', headCoachController.getAdvice);
coachRoutes.post('/macrocycle', headCoachController.generateMacrocycle);