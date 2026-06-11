import { Hono } from 'hono';
import { strengthController } from '../controllers/strengthController';

export const strengthRoutes = new Hono();

// ============================================================================
// MÓDULO 1 - LABORATÓRIO DE FORÇA (IronLog)
// Autenticação: Herdada do Roteador Central (api.ts -> privateAppRoutes)
// ============================================================================

// 1. Consulta de Fichas (Templates)
strengthRoutes.get('/templates', strengthController.listTemplates);
strengthRoutes.get('/templates/:id/exercises', strengthController.getTemplateExercises);

// 2. Registro e Auditoria de Sessões Executadas
strengthRoutes.post('/log', strengthController.logWorkout);
strengthRoutes.get('/log/:sessionId/audit', strengthController.getAudit);

// 3. Gerenciamento de Fichas e Biblioteca
strengthRoutes.get('/library', strengthController.searchLibrary);
strengthRoutes.post('/templates/:id/exercises', strengthController.addExerciseToTemplate);
strengthRoutes.delete('/templates/:id/exercises/:itemId', strengthController.removeExerciseFromTemplate);