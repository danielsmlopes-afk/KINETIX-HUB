import { Hono } from 'hono';
import { EncyclopediaController } from '../controllers/encyclopediaController';

const encyclopediaRoutes = new Hono();

// GET /api/encyclopedia - Retorna o histórico de operações (Monumentos e Epic Rides)
encyclopediaRoutes.get('/', EncyclopediaController.getEncyclopedia);

// GET /api/encyclopedia/version - Retorna o timestamp de controle de cache (Offline-First)
encyclopediaRoutes.get('/version', EncyclopediaController.getVersion);

export { encyclopediaRoutes };
