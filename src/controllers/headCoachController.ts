import { Context } from 'hono';
import { db } from '@/db';
import { plannedWorkouts, races } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { askHeadCoach, askHeadCoachForMacrocycle } from '@/services/headCoachService';
import { athleteRepository } from '@/repositories/athleteRepository';

export const headCoachController = {
  async getAdvice(c: Context) {
    try {
      const athlete = await athleteRepository.getPrimaryAthlete();
      if (!athlete) {
        return c.json({ error: "Atleta principal não encontrado.", code: "ATHLETE_NOT_FOUND" }, 404);
      }

      const body = await c.req.json().catch(() => ({}));
      const { question } = body;

      if (!question) {
        return c.json({ error: "Você precisa enviar uma 'question' para o Coach.", code: "MISSING_PARAM" }, 400);
      }

      // Passamos o nome do atleta para criar empatia inicial. Em breve, injetaremos os treinos pulados aqui.
      const advice = await askHeadCoach(question, { athleteName: athlete.name });

      return c.json({ data: { advice } });
    } catch (error) {
      console.error('❌ Erro no Head Coach Controller:', error);
      const message = error instanceof Error ? error.message : "Erro interno do Head Coach.";
      return c.json({ error: message, code: "COACH_ERR" }, 500);
    }
  },

  async generateMacrocycle(c: Context) {
    try {
      const athlete = await athleteRepository.getPrimaryAthlete();
      if (!athlete) {
        return c.json({ error: "Atleta não encontrado.", code: "ATHLETE_NOT_FOUND" }, 404);
      }

      const body = await c.req.json().catch(() => ({}));
      const { raceId } = body;

      if (!raceId) {
        return c.json({ error: "É necessário enviar o 'raceId' da prova alvo.", code: "MISSING_PARAM" }, 400);
      }

      const raceData = await db.select().from(races).where(eq(races.id, raceId));
      if (raceData.length === 0) return c.json({ error: "Prova não encontrada.", code: "NOT_FOUND" }, 404);
      
      const targetRace = raceData[0];

      const existing = await db.select().from(plannedWorkouts).where(
        and(eq(plannedWorkouts.athleteId, athlete.id), gte(plannedWorkouts.date, new Date()), lte(plannedWorkouts.date, targetRace.date))
      );

      const newPlan = await askHeadCoachForMacrocycle({
        athleteName: athlete.name,
        targetRaceName: targetRace.name || targetRace.category,
        targetRaceDate: targetRace.date.toISOString(),
        targetDistanceKm: targetRace.distance,
        existingWorkouts: existing.length > 0 ? existing : undefined
      });

      if (newPlan.length > 0) {
        await db.delete(plannedWorkouts).where(and(eq(plannedWorkouts.athleteId, athlete.id), gte(plannedWorkouts.date, new Date()), lte(plannedWorkouts.date, targetRace.date)));
        const valuesToInsert = newPlan.map(w => ({ athleteId: athlete.id, date: new Date(w.date), activityType: w.activityType, title: w.title, details: w.details || {}, isImported: false }));
        await db.insert(plannedWorkouts).values(valuesToInsert);
      }

      return c.json({ data: { message: "Macrociclo gerado/adaptado com sucesso!", count: newPlan.length } });
    } catch (error) {
      console.error('❌ Erro no Head Coach ao gerar macrociclo:', error);
      return c.json({ error: "Erro interno", code: "COACH_ERR" }, 500);
    }
  }
};