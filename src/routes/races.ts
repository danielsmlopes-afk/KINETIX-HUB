import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { races } from '@/db/schema';

const racesRouter = new Hono();

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
    const { name, category, date, distance, startTime, startLocation, isTarget } = body;

    // Validação estrita conforme as regras de negócio
    if (!name || !category || !date || !distance || !startTime || !startLocation) {
      return c.json({ success: false, error: "Dados incompletos. Requer: name, category, date, distance, startTime, startLocation.", code: "MISSING_FIELDS" }, 400);
    }

    const inserted = await db.insert(races).values({
      name,
      category,
      date: new Date(date),
      distance,
      startTime,
      startLocation,
      isTarget: isTarget || false,
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
    const { name, category, date, distance, startTime, startLocation, isTarget } = body;

    // Atualiza apenas os campos que foram enviados na requisição
    const updated = await db.update(races)
      .set({
        ...(name && { name }),
        ...(category && { category }),
        ...(date && { date: new Date(date) }),
        ...(distance && { distance }),
        ...(startTime && { startTime }),
        ...(startLocation && { startLocation }),
        ...(isTarget !== undefined && { isTarget })
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