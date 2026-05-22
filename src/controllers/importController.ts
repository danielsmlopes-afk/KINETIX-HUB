import { Context } from 'hono';
import { inArray, and, eq, asc } from 'drizzle-orm';
import { db } from '@/db';
import { plannedWorkouts } from '@/db/schema';
import { athleteRepository } from '@/repositories/athleteRepository';
import { workoutBatchSchema, WorkoutPayload } from '@/validators/workoutSchema';

export const importController = {
  async importPlan(c: Context) {
    try {
      const body = await c.req.json().catch(() => ({}));
      
      // O Zod valida o corpo 'unknown' e retorna os dados perfeitamente tipados se houver sucesso
      const parsed = workoutBatchSchema.safeParse(body);

      if (!parsed.success) {
        return c.json({ error: "Invalid JSON", code: "VALIDATION_ERR", details: parsed.error.format() }, 400);
      }

      const athlete = await athleteRepository.getPrimaryAthlete();
      if (!athlete) {
        return c.json({ error: "Atleta principal não encontrado.", code: "ATHLETE_NOT_FOUND" }, 404);
      }

      // Aqui garantimos que workouts é estritamente o nosso array validado
      const workouts: WorkoutPayload = parsed.data;
      
      if (workouts.length === 0) {
        return c.json({ data: { message: "Nenhum treino fornecido na planilha.", count: 0 } });
      }

      // Extrai datas únicas para processamento "Atômico" na reposição
      const uniqueDateStrings = Array.from(
        new Set(workouts.map((w: WorkoutPayload[number]) => new Date(w.date).toISOString()))
      ) as string[];
      const datesToClear = uniqueDateStrings.map((d) => new Date(d));

      // 1. Apaga treinos antigos nestas datas (Garante Prioridade Absoluta da nova planilha)
      const deleted = await db.delete(plannedWorkouts)
        .where(and(eq(plannedWorkouts.athleteId, athlete.id), inArray(plannedWorkouts.date, datesToClear)))
        .returning({ id: plannedWorkouts.id });

      if (deleted.length > 0) {
        console.log(`ℹ️ Removidos ${deleted.length} treinos antigos para dar lugar à nova planilha.`);
      }

      // 2. Insere os novos treinos (Batch Insert)
      const valuesToInsert = workouts.map((w: WorkoutPayload[number]) => ({
        athleteId: athlete.id,
        date: new Date(w.date),
        activityType: w.type,
        title: w.title,
        details: w.details || {},
        isImported: true
      }));

      const inserted = await db.insert(plannedWorkouts).values(valuesToInsert).returning();

      return c.json({ data: { message: "Planilha importada com sucesso", count: inserted.length } }, 201);
    } catch (error) {
      console.error('❌ Erro na importação da planilha:', error);
      return c.json({ error: "Erro interno ao processar a importação.", code: "INTERNAL_ERR" }, 500);
    }
  },

  async getPlan(c: Context) {
    try {
      const athlete = await athleteRepository.getPrimaryAthlete();
      if (!athlete) {
        return c.json({ error: "Atleta principal não encontrado.", code: "ATHLETE_NOT_FOUND" }, 404);
      }

      const workouts = await db.select().from(plannedWorkouts)
        .where(eq(plannedWorkouts.athleteId, athlete.id))
        .orderBy(asc(plannedWorkouts.date));

      return c.json({ data: workouts });
    } catch (error) {
      console.error('❌ Erro ao buscar planilha:', error);
      return c.json({ error: "Erro interno ao buscar a planilha.", code: "INTERNAL_ERR" }, 500);
    }
  },

  async deletePlan(c: Context) {
    try {
      const id = c.req.param('id');
      
      if (!id) {
        return c.json({ error: "ID não fornecido na URL.", code: "MISSING_PARAM" }, 400);
      }

      const deleted = await db.delete(plannedWorkouts)
        .where(eq(plannedWorkouts.id, id))
        .returning();

      if (deleted.length === 0) {
        return c.json({ error: "Treino agendado não encontrado.", code: "NOT_FOUND" }, 404);
      }

      return c.json({ data: { message: "Treino cancelado (pulado) com sucesso.", deleted: deleted[0] } });
    } catch (error) {
      console.error('❌ Erro ao deletar treino agendado:', error);
      return c.json({ error: "Erro interno ao excluir o treino.", code: "INTERNAL_ERR" }, 500);
    }
  }
};