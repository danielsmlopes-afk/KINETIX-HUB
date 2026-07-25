import { db } from '../db';
import { exerciseLibrary, workoutTemplates, workoutTemplateItems } from '../db/schema';
import { eq, inArray, like } from 'drizzle-orm';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';

export const updateWorkoutsV2 = async () => {
  console.log('🌱 Iniciando atualização das Fichas de Treino (V2)...');

  try {
    // 1. Limpeza: Encontrar e deletar as Fichas antigas
    console.log('Apagando Fichas antigas...');
    const oldTemplates = await db.select().from(workoutTemplates).where(
      like(workoutTemplates.name, 'Ficha %')
    );

    for (const t of oldTemplates) {
      await db.delete(workoutTemplateItems).where(eq(workoutTemplateItems.templateId, t.id));
      await db.delete(workoutTemplates).where(eq(workoutTemplates.id, t.id));
    }

    // 2. Criação: Inserindo as novas Fichas
    console.log('Inserindo Ficha A...');
    const fichaA_Id = uuidv4();
    await db.insert(workoutTemplates).values({
      id: fichaA_Id,
      name: 'Ficha A - Inferiores',
      description: 'Foco em quadríceps e cadeia posterior.',
    });

    const exercisesA = [
      { name: 'Agachamento Sumô (HALTR)', sets: 3, reps: '10', notes: null },
      { name: 'Leg Press 45º (16)', sets: 3, reps: '10', notes: null },
      { name: 'Extensora Uni. (10)', sets: 3, reps: '10', notes: null },
      { name: 'Mesa Flexora (12)', sets: 3, reps: '10', notes: null },
      { name: 'Cadeira Flexora (11)', sets: 3, reps: '10', notes: null },
      { name: 'Flexora Vert. (13)', sets: 3, reps: '10', notes: null },
      { name: 'Abdução (14)', sets: 3, reps: '10', notes: null },
      { name: 'Glúteo (22)', sets: 3, reps: '10', notes: null },
      { name: 'Panturrilha (LIVRE)', sets: 3, reps: '15', notes: null },
      { name: 'Tibial Anterior (43)', sets: 3, reps: '15', notes: null },
    ];

    console.log('Inserindo Ficha B...');
    const fichaB_Id = uuidv4();
    await db.insert(workoutTemplates).values({
      id: fichaB_Id,
      name: 'Ficha B - Anterior',
      description: 'Foco em peito, ombro, tríceps e core.',
    });

    const exercisesB = [
      { name: 'Supino Vert. (25)', sets: 3, reps: '10', notes: null },
      { name: 'Fly Inclinado (HALTE)', sets: 3, reps: '10', notes: null },
      { name: 'Crucifixo Máq. (23)', sets: 3, reps: '10', notes: null },
      { name: 'Elev. Frontal (29)', sets: 3, reps: '10', notes: null },
      { name: 'Elev. Lateral (HALTE)', sets: 3, reps: '10', notes: null },
      { name: 'Tríceps Pulley (29)', sets: 3, reps: '10', notes: null },
      { name: 'Tríceps Banco (37)', sets: 3, reps: '10', notes: null },
      { name: 'Abdominal (38)', sets: 3, reps: '10', notes: null },
      { name: 'Prancha (COLCH)', sets: 3, reps: '30s', notes: null },
    ];

    console.log('Inserindo Ficha C...');
    const fichaC_Id = uuidv4();
    await db.insert(workoutTemplates).values({
      id: fichaC_Id,
      name: 'Ficha C - Posterior',
      description: 'Foco em costas, bíceps e lombar.',
    });

    const exercisesC = [
      { name: 'Pulley Fr. Rom. (32)', sets: 3, reps: '10', notes: null },
      { name: 'Remada Trian. (33)', sets: 3, reps: '10', notes: null },
      { name: 'Remada Supi. (34B)', sets: 3, reps: '10', notes: null },
      { name: 'Crucifixo Inv. (23)', sets: 3, reps: '10', notes: null },
      { name: 'Remada Alta (29)', sets: 3, reps: '10', notes: null },
      { name: 'Rosca Direta (BR)', sets: 3, reps: '10', notes: null },
      { name: 'Rosca Scott (35)', sets: 3, reps: '10', notes: null },
      { name: 'Rolete (ROLET)', sets: 3, reps: '1 volta', notes: null },
      { name: 'Perdigueiro (COLCH)', sets: 3, reps: '10', notes: null },
    ];

    const allTemplates = [
      { templateId: fichaA_Id, exercises: exercisesA, muscleGroup: 'Inferiores' },
      { templateId: fichaB_Id, exercises: exercisesB, muscleGroup: 'Peito' },
      { templateId: fichaC_Id, exercises: exercisesC, muscleGroup: 'Costas' },
    ];

    console.log('Gravando exercicios no Exercise Library e associando as Fichas...');
    for (const tpl of allTemplates) {
      for (const ex of tpl.exercises) {
        const exId = uuidv4();
        await db.insert(exerciseLibrary).values({ id: exId, name: ex.name, muscleGroup: tpl.muscleGroup });
        await db.insert(workoutTemplateItems).values({
          id: uuidv4(),
          templateId: tpl.templateId,
          exerciseId: exId,
          sets: ex.sets,
          reps: ex.reps,
          notes: ex.notes
        });
      }
    }
    console.log('✅ Novas Fichas persistidas com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante atualização:', error);
  }
};

updateWorkoutsV2();
