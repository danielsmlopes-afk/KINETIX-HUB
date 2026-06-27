import { Context } from 'hono';
import { db } from '@/db';
import { shoes, consumables } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export const gearController = {
  async getShoes(c: Context) {
    try {
      // Busca os tênis e ordena do mais rodado (maior quilometragem) para o mais novo
      const shoesList = await db.select().from(shoes).orderBy(desc(shoes.mileage));
      return c.json({ data: shoesList }, 200);
    } catch (error) {
      console.error('❌ Erro ao buscar tênis no Arsenal:', error);
      return c.json(
        { error: 'Erro interno ao buscar tênis no Arsenal.', code: 'INTERNAL_ERROR' },
        500
      );
    }
  },

  async addShoe(c: Context) {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { name, stravaGearId, mileage } = body;

      if (!name) {
        return c.json({ error: 'O nome do equipamento é obrigatório.', code: 'MISSING_PARAM' }, 400);
      }

      const inserted = await db.insert(shoes).values({
        name,
        stravaGearId: stravaGearId || null,
        mileage: mileage ? parseFloat(mileage) : 0,
      }).returning();

      return c.json({ data: inserted[0] }, 201);
    } catch (error) {
      console.error('❌ Erro ao adicionar tênis no Arsenal:', error);
      return c.json({ error: 'Erro interno ao adicionar tênis no Arsenal.', code: 'INTERNAL_ERROR' }, 500);
    }
  },

  async getConsumables(c: Context) {
    try {
      const list = await db.select().from(consumables);
      return c.json({ data: list }, 200);
    } catch (error) {
      console.error('❌ Erro ao buscar consumíveis:', error);
      return c.json(
        { error: 'Erro interno ao buscar consumíveis.', code: 'INTERNAL_ERROR' },
        500
      );
    }
  },

  async replenishConsumable(c: Context) {
    try {
      const id = c.req.param('id');
      if (!id) {
        return c.json({ error: 'O ID do consumível é obrigatório.', code: 'MISSING_PARAM' }, 400);
      }

      const body = await c.req.json().catch(() => ({}));
      const quantity = parseInt(body.quantity);

      if (isNaN(quantity) || quantity <= 0) {
        return c.json({ error: 'A quantidade de reposição deve ser um número maior que zero.', code: 'INVALID_PARAM' }, 400);
      }

      // Busca o consumível existente
      const items = await db.select().from(consumables).where(eq(consumables.id, id)).limit(1);
      if (items.length === 0) {
        return c.json({ error: 'Consumível não encontrado.', code: 'NOT_FOUND' }, 404);
      }

      const item = items[0];
      const newStock = item.currentStock + quantity;

      const updated = await db.update(consumables)
        .set({ currentStock: newStock })
        .where(eq(consumables.id, id))
        .returning();

      return c.json({ data: updated[0] }, 200);
    } catch (error) {
      console.error('❌ Erro ao repor estoque de consumível:', error);
      return c.json(
        { error: 'Erro interno ao repor estoque de consumível.', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
};