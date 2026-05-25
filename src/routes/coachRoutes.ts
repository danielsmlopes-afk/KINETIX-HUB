import { Hono } from 'hono';
import { headCoachController } from '@/controllers/headCoachController';
import { coachController } from '@/controllers/coachController';

export const coachRoutes = new Hono();

// Fase 7: Head Coach IA - Consultoria e Recálculo de Rota
coachRoutes.post('/advice', headCoachController.getAdvice);
coachRoutes.post('/macrocycle', headCoachController.generateMacrocycle);

// Ajuste Manual de Compliance (Sensores de Esteira / Fallback)
coachRoutes.post('/compliance/:id', coachController.updateCompliance);