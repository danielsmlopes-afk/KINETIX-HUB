import { Context } from 'hono';
import { db } from '@/db';
import { races, workoutSessions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { athleteRepository } from '@/repositories/athleteRepository';

export const dossierController = {
  async getDossier(c: Context) {
    try {
      const athlete = await athleteRepository.getPrimaryAthlete();
      if (!athlete) return c.json({ error: 'Atleta não encontrado', code: 'NOT_FOUND' }, 404);

      const allRaces = await db.select().from(races).orderBy(desc(races.date));
      
      const sessions = await db.select().from(workoutSessions)
        .where(eq(workoutSessions.athleteId, athlete.id));

      const isWithin = (val: number, target: number) => val >= target * 0.97 && val <= target * 1.03;

      type PR = { time: number; date: Date; distance: number };
      let best10k: PR | null = null;
      let best21k: PR | null = null;
      let best42k: PR | null = null;

      for (const s of sessions) {
        if (!s.distance || !s.durationMinutes) continue;
        const d = s.distance / 1000;
        const time = s.durationMinutes; 

        if (isWithin(d, 10)) {
          if (!best10k || time < best10k.time) best10k = { time, date: s.date, distance: d };
        } else if (isWithin(d, 21.097)) {
          if (!best21k || time < best21k.time) best21k = { time, date: s.date, distance: d };
        } else if (isWithin(d, 42.195)) {
          if (!best42k || time < best42k.time) best42k = { time, date: s.date, distance: d };
        }
      }

      return c.json({ data: { races: allRaces, personalRecords: { '10k': best10k, '21k': best21k, '42k': best42k } } }, 200);
    } catch (error) {
      console.error('❌ Erro no Dossiê:', error);
      return c.json({ error: 'Erro interno ao gerar dossiê.', code: 'INTERNAL_ERROR' }, 500);
    }
  },

  async listDossiers(c: Context) {
    try {
      // Matriz de PDFs executivos na Cloud/Storage
      const dossiers = [
        { id: 1, title: 'Planilha Definitiva Nike SP', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', date: '2026-05-01' },
        { id: 2, title: 'Laudo Clínico (Bioimpedância)', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', date: '2026-05-15' }
      ];
      return c.json({ data: dossiers }, 200);
    } catch (error) {
      return c.json({ error: 'Erro ao listar dossiês.', code: 'INTERNAL_ERROR' }, 500);
    }
  }
};