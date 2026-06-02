import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workoutTemplates, workoutTemplateItems, exerciseLibrary, workoutSessions, strengthLogs } from '@/db/schema';

export const strengthRepository = {
  async getWorkoutTemplate(name: string) {
    const template = await db.select().from(workoutTemplates).where(eq(workoutTemplates.name, name)).limit(1);
    
    if (template.length === 0) {
      return null;
    }

    const items = await db.select({
      id: workoutTemplateItems.id,
      sets: workoutTemplateItems.sets,
      reps: workoutTemplateItems.reps,
      notes: workoutTemplateItems.notes,
      exercise: {
        id: exerciseLibrary.id,
        name: exerciseLibrary.name,
        muscleGroup: exerciseLibrary.muscleGroup,
        equipmentType: exerciseLibrary.equipmentType
      }
    })
    .from(workoutTemplateItems)
    .innerJoin(exerciseLibrary, eq(workoutTemplateItems.exerciseId, exerciseLibrary.id))
    .where(eq(workoutTemplateItems.templateId, template[0].id));

    return { ...template[0], items };
  },

  async getAllWorkoutTemplates() {
    const rows = await db.select({
      template: workoutTemplates,
      item: workoutTemplateItems,
      exercise: exerciseLibrary,
    })
    .from(workoutTemplates)
    .leftJoin(workoutTemplateItems, eq(workoutTemplates.id, workoutTemplateItems.templateId))
    .leftJoin(exerciseLibrary, eq(workoutTemplateItems.exerciseId, exerciseLibrary.id));

    // Inferência de Tipos Estrita
    type TemplateResult = typeof workoutTemplates.$inferSelect & {
      items: Array<{
        id: string;
        sets: number;
        reps: string;
        notes: string | null;
        exercise: typeof exerciseLibrary.$inferSelect;
      }>;
    };

    const map = new Map<string, TemplateResult>();

    for (const row of rows) {
      if (!map.has(row.template.id)) {
        map.set(row.template.id, { ...row.template, items: [] });
      }
      if (row.item && row.exercise) {
        map.get(row.template.id)!.items.push({
          id: row.item.id,
          sets: row.item.sets,
          reps: row.item.reps,
          notes: row.item.notes,
          exercise: row.exercise
        });
      }
    }
    return Array.from(map.values());
  },

  async updateWorkoutTemplate(name: string, items: Array<{ exerciseId: string, sets: number, reps: string, notes?: string }>) {
    await db.transaction(async (tx) => {
      const template = await tx.select().from(workoutTemplates).where(eq(workoutTemplates.name, name)).limit(1);
      let templateId: string;

      if (template.length === 0) {
        const inserted = await tx.insert(workoutTemplates).values({ name, description: 'Gerado dinamicamente' }).returning();
        templateId = inserted[0].id;
      } else {
        templateId = template[0].id;
      }

      await tx.delete(workoutTemplateItems).where(eq(workoutTemplateItems.templateId, templateId));

      if (items.length > 0) {
        const newItems = items.map(item => ({ templateId, exerciseId: item.exerciseId, sets: item.sets, reps: item.reps, notes: item.notes || null }));
        await tx.insert(workoutTemplateItems).values(newItems);
      }
    });
  },

  async saveStrengthLog(
    athleteId: string, 
    durationMinutes: number, 
    logs: Array<{ exerciseId: string; actualSets: number; actualReps: string; weightUsed: number; notes?: string }>,
    weather: string | null = null
  ) {
    try {
      const [session] = await db.insert(workoutSessions).values({
        athleteId,
        date: new Date(),
        durationMinutes,
        weather
      }).returning();

      if (logs.length > 0) {
        const logsToInsert = logs.map(log => ({
          sessionId: session.id,
          exerciseId: log.exerciseId,
          actualSets: log.actualSets,
          actualReps: log.actualReps,
          weightUsed: log.weightUsed,
          notes: log.notes || null
        }));
        await db.insert(strengthLogs).values(logsToInsert);
      }
      return session;
    } catch (error) {
      console.error('[IRONLOG] Erro ao salvar:', error);
      throw new Error('Falha ao registrar sessão de força no banco de dados.');
    }
  }
};