import { Hono } from 'hono';
import { hallOfFameController } from '@/controllers/hallOfFameController';
import { db } from '@/db';
import { monumentRecords } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchMapStaticBuffer } from '@/services/pdfGeneratorService';

const hallOfFameRoutes = new Hono();

hallOfFameRoutes.get('/', hallOfFameController.getRecords);
hallOfFameRoutes.get('/:id/dossier', hallOfFameController.getDossier);
hallOfFameRoutes.patch('/:id/toggle-pr', hallOfFameController.togglePr);

hallOfFameRoutes.get('/:id/map', async (c) => {
  const id = c.req.param('id');
  const records = await db.select().from(monumentRecords).where(eq(monumentRecords.id, id));
  if (records.length === 0 || !records[0].polyline) {
    return c.text('Mapa indisponível na telemetria', 404);
  }
  const mapBuffer = await fetchMapStaticBuffer(records[0].polyline);
  if (!mapBuffer) return c.text('Erro ao renderizar imagem', 500);
  c.header('Content-Type', 'image/png');
  return c.body(new Uint8Array(mapBuffer));
});

export default hallOfFameRoutes;