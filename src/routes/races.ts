import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { races } from '@/db/schema';
import { z } from 'zod';

const racesRouter = new Hono();

const raceSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  category: z.enum(['P1', 'P2', 'P3']),
  date: z.string().datetime(), // ISO Date
  distance: z.number().positive("A distância deve ser um número positivo"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)$/, "Formato de hora HH:MM"),
  startLocation: z.string().min(1, "Localização é obrigatória"),
  isTarget: z.boolean().optional().default(false),
  targetPace: z.string().min(4, "Ex: 6:30 ou 6:30 a 7:00")
});

racesRouter.get('/', async (c) => {
  try {
    // Busca todas as provas ordenando da mais recente para a mais antiga
    const allRaces = await db.select().from(races).orderBy(desc(races.date));
    return c.json({ success: true, data: allRaces });
  } catch (error) {
    console.error('❌ Erro ao buscar provas na API:', error);
    return c.json({ success: false, error: 'Erro interno ao buscar provas.' }, 500);
  }
});

// Fase 5.1: Agendamento de Provas (Inclusão Manual)
racesRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = raceSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ success: false, error: "Falha na validação de dados.", code: "VALIDATION_ERROR", details: parsed.error.format() }, 400);
    }

    const { name, category, date, distance, startTime, startLocation, isTarget, targetPace } = parsed.data;

    const inserted = await db.insert(races).values({
      name,
      category,
      date: new Date(date),
      distance,
      startTime,
      startLocation,
      isTarget,
      targetPace,
    }).returning();

    return c.json({ success: true, data: inserted[0] }, 201);
  } catch (error) {
    console.error('❌ Erro ao agendar prova:', error);
    return c.json({ success: false, error: 'Erro interno ao cadastrar prova.' }, 500);
  }
});

// Fase 5.1: Edição de Prova Agendada (PUT /:id)
racesRouter.put('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const body = await c.req.json();
    const parsed = raceSchema.partial().safeParse(body);

    if (!parsed.success) {
      return c.json({ success: false, error: "Falha na validação de dados.", code: "VALIDATION_ERROR", details: parsed.error.format() }, 400);
    }

    const { name, category, date, distance, startTime, startLocation, isTarget, targetPace } = parsed.data;

    // Atualiza apenas os campos que foram enviados na requisição
    const updated = await db.update(races)
      .set({
        ...(name && { name }),
        ...(category && { category }),
        ...(date && { date: new Date(date) }),
        ...(distance && { distance }),
        ...(startTime && { startTime }),
        ...(startLocation && { startLocation }),
        ...(isTarget !== undefined && { isTarget }),
        ...(targetPace && { targetPace })
      })
      .where(eq(races.id, id))
      .returning();

    if (updated.length === 0) {
      return c.json({ success: false, error: "Prova não encontrada.", code: "NOT_FOUND" }, 404);
    }

    return c.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error(`❌ Erro ao atualizar prova ${id}:`, error);
    return c.json({ success: false, error: 'Erro interno ao atualizar prova.' }, 500);
  }
});

// Fase 5.1: Cancelamento/Exclusão de Prova Agendada (DELETE /:id)
racesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const deleted = await db.delete(races)
      .where(eq(races.id, id))
      .returning();

    if (deleted.length === 0) {
      return c.json({ success: false, error: "Prova não encontrada.", code: "NOT_FOUND" }, 404);
    }

    return c.json({ success: true, message: "Prova cancelada/excluída com sucesso.", data: deleted[0] });
  } catch (error) {
    console.error(`❌ Erro ao deletar prova ${id}:`, error);
    return c.json({ success: false, error: 'Erro interno ao excluir prova.' }, 500);
  }
});

export default racesRouter;
