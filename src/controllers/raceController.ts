import { Context } from 'hono';
import { db } from '@/db';
import { races } from '@/db/schema';

export const raceController = {
  async addRace(c: Context) {
    try {
      const body = await c.req.json();
      
      const inserted = await db.insert(races).values({
        name: body.name,
        category: body.category,
        date: new Date(body.date),
        distance: Number(body.distance),
        startTime: body.startTime || '06:00',
        startLocation: body.startLocation || 'Desconhecido',
        targetPace: body.targetPace || 'Auto',
        isTarget: body.category === 'P1',
      }).returning();

      return c.json({ 
        data: { 
          message: 'Prova registrada com sucesso!',
          race: inserted[0],
          requiresMacrocycle: body.category === 'P1'
        } 
      }, 201);
    } catch (error) {
      console.error('❌ Erro ao adicionar prova:', error);
      return c.json({ error: 'Erro interno ao adicionar prova.', code: 'INTERNAL_ERROR' }, 500);
    }
  }
};