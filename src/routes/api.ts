// Arquivo: src/routes/api.ts
import { Hono } from 'hono';
import { athleteController } from '@/controllers/athleteController';
import { telegramController } from '@/controllers/telegramController';

export const apiRoutes = new Hono();

// Mapeamento de rotas
apiRoutes.get('/athlete', athleteController.getProfile);
apiRoutes.post('/webhook/telegram', telegramController.handleWebhook);