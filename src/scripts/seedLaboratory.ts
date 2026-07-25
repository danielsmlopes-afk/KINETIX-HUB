import { db } from '../db';
import { exerciseLibrary, workoutTemplates, workoutTemplateItems } from '../db/schema';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';

export const seedLaboratory = async () => {
  console.log('🌱 Iniciando Seed do Laboratório (IronLog V2)...');

  try {
    await db.transaction(async (tx) => {
      // Ficha A
      const fichaA_Id = uuidv4();
      await tx.insert(workoutTemplates).values({
        id: fichaA_Id,
        name: 'Ficha A - Inferiores',
        description: 'Foco em quadríceps e cadeia posterior.',
      });

      const exercisesA = [
        { name: 'Extensora', sets: 3, reps: '10', notes: null },
        { name: 'Agachamento', sets: 3, reps: '10', notes: null },
        { name: 'Leg45Uni', sets: 3, reps: '10', notes: null },
        { name: 'Flexora', sets: 3, reps: '10', notes: null },
        { name: 'Abdução', sets: 3, reps: '10', notes: null },
        { name: 'Glúteo', sets: 3, reps: '10', notes: null },
        { name: 'Panturrilhas', sets: 3, reps: '10', notes: null },
      ];

      // Ficha B
      const fichaB_Id = uuidv4();
      await tx.insert(workoutTemplates).values({
        id: fichaB_Id,
        name: 'Ficha B - Superiores e Core',
        description: 'Foco em peito, tríceps e estabilização.',
      });

      const exercisesB = [
        { name: 'SupinoVert', sets: 3, reps: '10', notes: null },
        { name: 'FlyInc', sets: 3, reps: '10', notes: null },
        { name: 'Crucifixo', sets: 3, reps: '10', notes: null },
        { name: 'Elev', sets: 3, reps: '10', notes: null },
        { name: 'TrícTesta', sets: 3, reps: '10', notes: null },
        { name: 'Banco', sets: 3, reps: '10', notes: null },
        { name: 'Abd', sets: 3, reps: '10', notes: null },
        { name: 'Prancha', sets: 3, reps: '40s', notes: '1 minuto de descanso' },
      ];

      // Ficha C
      const fichaC_Id = uuidv4();
      await tx.insert(workoutTemplates).values({
        id: fichaC_Id,
        name: 'Ficha C - Costas e Lombar',
        description: 'Foco em dorsais, bíceps e lombar.',
      });

      const exercisesC = [
        { name: 'Pulley', sets: 3, reps: '10', notes: null },
        { name: 'Remada', sets: 3, reps: '10', notes: null },
        { name: 'CrucifixoInv', sets: 3, reps: '10', notes: null },
        { name: 'Rosca', sets: 3, reps: '10', notes: null },
        { name: 'Rolete', sets: 3, reps: 'N', notes: '1 minuto de descanso' },
        { name: 'ExtLombar', sets: 3, reps: '10', notes: null },
      ];

      // Persistindo os itens das fichas
      const allTemplates = [
        { templateId: fichaA_Id, exercises: exercisesA },
        { templateId: fichaB_Id, exercises: exercisesB },
        { templateId: fichaC_Id, exercises: exercisesC },
      ];

      for (const tpl of allTemplates) {
        for (const ex of tpl.exercises) {
          const exId = uuidv4();
          await tx.insert(exerciseLibrary).values({ id: exId, name: ex.name, muscleGroup: 'Mixed' });
          await tx.insert(workoutTemplateItems).values({
            id: uuidv4(),
            templateId: tpl.templateId,
            exerciseId: exId,
            sets: ex.sets,
            reps: ex.reps,
            notes: ex.notes
          });
        }
      }
    });
    console.log('✅ Seed finalizado com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante injeção no Banco de Dados:', error);
  }
};

// seedLaboratory(); // Descomente para executar o script de forma avulsa
