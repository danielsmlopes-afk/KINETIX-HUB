import { Hono } from 'hono';
import { importController } from '@/controllers/importController';

export const importRoutes = new Hono();

// Fase 5.2: Ingestão de Planilha via JSON
importRoutes.post('/plan', importController.importPlan);
importRoutes.get('/plan', importController.getPlan);
importRoutes.delete('/plan/:id', importController.deletePlan);
