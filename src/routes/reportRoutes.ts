import { Hono } from 'hono';
import { reportController } from '../controllers/reportController';
import { fetchMapStaticBuffer } from '../services/pdfGeneratorService';

export const reportRoutes = new Hono();

// Listagem dinâmica de todos os dossiês disponíveis
reportRoutes.get('/', reportController.listReports);

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

// ============================================================================
// PONTE CARTOGRÁFICA (Proxy MapStatic)
// ============================================================================
// Rota acessível pelo Flutter via http.get() para embutir mapas na Enciclopédia
reportRoutes.get('/maps/render', async (c) => {
  const polyline = c.req.query('polyline');
  
  if (!polyline) {
    return c.json({ error: 'Polyline ausente' }, 400);
  }

  try {
    // Requisita a imagem do motor Docker interno (com cache em memória via Redis)
    const imageBuffer = await fetchMapStaticBuffer(polyline);
    
    if (!imageBuffer) {
      return c.json({ error: 'Mapa indisponível' }, 404);
    }

    c.header('Content-Type', 'image/png');
    c.header('Cache-Control', 'public, max-age=31536000'); // Cache agressivo no app (1 ano)
    return c.body(new Uint8Array(imageBuffer));
  } catch (error) {
    console.error('⚠️ [Map Proxy] Falha ao renderizar mapa:', error);
    return c.json({ error: 'Falha ao renderizar mapa estático' }, 500);
  }
});