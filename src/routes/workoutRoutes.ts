import { Hono } from 'hono';
import { workoutController } from '@/controllers/workoutController';
import { db } from '@/db';
import { workoutSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchMapStaticBuffer } from '@/services/pdfGeneratorService';

const workoutRoutes = new Hono();

workoutRoutes.post('/validate-manual', workoutController.validateManual);

workoutRoutes.get('/:sessionId/map', async (c) => {
  const sessionId = c.req.param('sessionId');
  
  try {
    const session = await db.query.workoutSessions.findFirst({
      where: eq(workoutSessions.id, sessionId)
    });

    if (!session || !session.mapPolyline) {
      return c.text('Mapa não disponível para esta sessão', 404);
    }

    const mapBuffer = await fetchMapStaticBuffer(session.mapPolyline);
    if (!mapBuffer) return c.text('Erro ao renderizar mapa no contêiner MapStatic', 500);

    c.header('Content-Type', 'image/png');
    return c.body(new Uint8Array(mapBuffer));
  } catch (error) {
    console.error('❌ [Proxy MapStatic] Erro interno:', error);
    return c.text('Erro Interno', 500);
  }
});

export { workoutRoutes };