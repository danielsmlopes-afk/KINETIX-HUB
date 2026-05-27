import { Context } from 'hono';
import { db } from '@/db';
import { races } from '@/db/schema';
import { macrocycleService } from '@/services/macrocycleService';

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

      // Gatilho do Motor Cognitivo Assíncrono para Todas as Provas (Periodização Dinâmica)
      setTimeout(() => {
        macrocycleService.generateMacrocycle(
          body.name || 'Prova', 
          Number(body.distance), 
          new Date(body.date),
          body.category || 'P3',
          inserted[0].id
        ).catch(console.error);
      }, 0);

      return c.json({ 
        data: { 
          message: 'Prova registrada com sucesso!',
          race: inserted[0],
          requiresMacrocycle: true
        } 
      }, 201);
    } catch (error) {
      console.error('❌ Erro ao adicionar prova:', error);
      return c.json({ error: 'Erro interno ao adicionar prova.', code: 'INTERNAL_ERROR' }, 500);
    }
  }
};