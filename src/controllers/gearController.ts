import { Context } from 'hono';
import { db } from '@/db';
import { shoes } from '@/db/schema';
import { desc } from 'drizzle-orm';

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
  }
};