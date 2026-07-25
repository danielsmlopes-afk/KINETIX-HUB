import { Context } from 'hono';
import { db } from '@/db';
import { plannedWorkouts, races, bioimpedanceLogs } from '@/db/schema';
import { eq, and, gte, lte, desc, between } from 'drizzle-orm';
import { askHeadCoach, askHeadCoachForMacrocycle, askHeadCoachForRecalculation } from '@/services/headCoachService';
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

      // Busca a bioimpedância mais recente
      const lastBio = await db.select().from(bioimpedanceLogs)
        .where(eq(bioimpedanceLogs.athleteId, athlete.id))
        .orderBy(desc(bioimpedanceLogs.date))
        .limit(1);
      const bioData = lastBio.length > 0 ? lastBio[0] : undefined;

      // Lógica de Smart Pace Conservador (4 a 6%)
      let paceInstruction = targetRace.targetPace || 'Não definido';
      if (paceInstruction.toLowerCase() === 'auto') {
         const similarRaces = await db.select().from(races)
            .where(between(races.distance, targetRace.distance * 0.9, targetRace.distance * 1.1))
            .orderBy(desc(races.date));
         const completedRace = similarRaces.find(r => r.movingTime != null && r.movingTime > 0);
         if (completedRace) {
            const paceDecimal = (completedRace.movingTime! / 60) / completedRace.distance;
            const paceMins = Math.floor(paceDecimal);
            const paceSecs = Math.round((paceDecimal - paceMins) * 60);
            const paceStr = `${paceMins}:${paceSecs.toString().padStart(2, '0')}`;
            paceInstruction = `O atleta concluiu a prova ${completedRace.name} (${completedRace.distance}km) com pace médio de ${paceStr}/km. Estipule um novo Pace Alvo que exija uma melhora progressiva e segura de 4% a 6% e use-o como alvo para estruturar a planilha.`;
         } else {
            paceInstruction = `Sem histórico exato. Estipule um Pace Alvo conservador para ${targetRace.distance}km com base na evolução.`;
         }
      } else {
         paceInstruction = `O atleta tem como meta realizar a prova com um pace de ${targetRace.targetPace}. Adapte os treinos com base nessa meta.`;
      }

      const existing = await db.select().from(plannedWorkouts).where(
        and(eq(plannedWorkouts.athleteId, athlete.id), gte(plannedWorkouts.date, new Date()), lte(plannedWorkouts.date, targetRace.date))
      );

      const newPlan = await askHeadCoachForMacrocycle({
        athleteName: athlete.name,
        targetRaceName: targetRace.name || targetRace.category,
        targetRaceDate: targetRace.date.toISOString(),
        targetDistanceKm: targetRace.distance,
        targetPaceInstruction: paceInstruction,
        existingWorkouts: existing.length > 0 ? existing : undefined,
        bioimpedance: bioData
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
  },

  async recalculateRoute(c: Context) {
    try {
      const athlete = await athleteRepository.getPrimaryAthlete();
      if (!athlete) {
        return c.json({ error: "Atleta principal não encontrado.", code: "ATHLETE_NOT_FOUND" }, 404);
      }

      const body = await c.req.json().catch(() => ({}));
      const { prompt } = body;

      if (!prompt) {
        return c.json({ error: "Você precisa enviar um 'prompt' descrevendo o ocorrido.", code: "MISSING_PARAM" }, 400);
      }

      // 1. Obter treinos planejados nos últimos 7 dias e próximos 14 dias
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const today = new Date(`${todayStr}T00:00:00Z`);
      
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
      
      const fourteenDaysAhead = new Date(today);
      fourteenDaysAhead.setUTCDate(fourteenDaysAhead.getUTCDate() + 14);

      const workouts = await db.select().from(plannedWorkouts).where(
        and(
          eq(plannedWorkouts.athleteId, athlete.id),
          gte(plannedWorkouts.date, sevenDaysAgo),
          lte(plannedWorkouts.date, fourteenDaysAhead)
        )
      );

      const recentWorkouts = workouts.filter(w => new Date(w.date) < today);
      const upcomingWorkouts = workouts.filter(w => new Date(w.date) >= today);

      const contextData = {
        athleteName: athlete.name,
        today: todayStr,
        treinosRecentes: recentWorkouts.map(w => ({
          id: w.id,
          date: w.date.toISOString().split('T')[0],
          type: w.activityType,
          title: w.title,
          status: w.complianceStatus || 'PENDING',
          feedback: w.complianceFeedback || ''
        })),
        proximosTreinos: upcomingWorkouts.map(w => ({
          id: w.id,
          date: w.date.toISOString().split('T')[0],
          type: w.activityType,
          title: w.title
        }))
      };

      // 2. Chamar a IA para efetuar o recálculo
      const aiResponse = await askHeadCoachForRecalculation(prompt, contextData);

      // 3. Aplicar as ações recomendadas pela IA no banco de dados
      const appliedUpdates = [];
      if (aiResponse.updates && Array.isArray(aiResponse.updates)) {
        for (const update of aiResponse.updates) {
          if (update.action === 'CANCEL') {
            await db.delete(plannedWorkouts).where(eq(plannedWorkouts.id, update.id));
            appliedUpdates.push({ id: update.id, action: 'CANCEL', notes: update.notes });
          } else if (update.action === 'RESCHEDULE' && update.newDate) {
            await db.update(plannedWorkouts).set({ date: new Date(update.newDate) }).where(eq(plannedWorkouts.id, update.id));
            appliedUpdates.push({ id: update.id, action: 'RESCHEDULE', newDate: update.newDate, notes: update.notes });
          }
        }
      }

      return c.json({
        data: {
          advice: aiResponse.advice,
          updates: appliedUpdates
        }
      });
    } catch (error) {
      console.error('❌ Erro no recalculateRoute do Head Coach:', error);
      const message = error instanceof Error ? error.message : "Erro interno do Head Coach.";
      return c.json({ error: message, code: "COACH_ERR" }, 500);
    }
  }
};
