import { db } from './index';
import { athletes, exercises, shoes, races, consumables, workoutSessions, treadmillIntervals, bioimpedanceLogs, exerciseLibrary, workoutTemplates, workoutTemplateItems } from './schema';

export async function seed() {
  console.log("🌱 Iniciando o processo de Seed no KINETIX HUB...");

  // ==========================================
  // 1. ATLETA PRINCIPAL (SINGLE-TENANT)
  // ==========================================
  let athleteData = await db.select().from(athletes).limit(1);
  let athleteId: string;
  
  if (athleteData.length === 0) {
    const inserted = await db.insert(athletes).values([{ name: 'Comandante Kinetix' }]).returning();
    athleteId = inserted[0].id;
  } else {
    athleteId = athleteData[0].id;
  }

  // ==========================================
  // 2. LOGÍSTICA & ESTOQUE
  // ==========================================
  await db.insert(shoes).values([
    { name: 'Fila Carbon Racer 3', stravaGearId: 'g12345' }, // Atualizado para sua preferência
    { name: 'Olympikus Corre', stravaGearId: 'g67890' }
  ]);

  await db.insert(consumables).values([
    { type: 'gel', name: 'Gel Z2', currentStock: 10, alertThreshold: 3 },
    { type: 'salt', name: 'Cápsula de Sal', currentStock: 30, alertThreshold: 5 }
  ]);

  // ==========================================
  // 3. BACKLOG DE PROVAS (PERENE)
  // ==========================================
  await db.insert(races).values([
    {
      name: 'Nike SP 21K',
      category: 'P1', // Foco Principal
      date: new Date('2026-07-26T06:00:00Z'),
      distance: 21.1,
      startTime: '06:00',
      startLocation: 'São Paulo',
      isTarget: true,
    },
    {
      name: 'Mizuno 21K',
      category: 'P2', // Prova futura no backlog
      date: new Date('2026-10-18T06:00:00Z'),
      distance: 21.1,
      startTime: '06:30',
      startLocation: 'São Paulo',
      isTarget: false,
    }
  ]);

  // ==========================================
  // 4. CORE DE FORÇA: IRONLOG_V2 (REALIDADE)
  // ==========================================
  console.log("🏋️ Inserindo Biblioteca de Exercícios e Fichas IronLog_V2...");
  
  const exercisesToInsert = [
    // Ficha A - Inferiores
    { name: 'Extensora', muscleGroup: 'Quadríceps', equipmentType: 'Máquina' },
    { name: 'Agachamento', muscleGroup: 'Pernas Completas', equipmentType: 'Livre/Barra' },
    { name: 'Leg 45 Unilateral', muscleGroup: 'Quadríceps/Glúteo', equipmentType: 'Máquina' },
    { name: 'Flexora (Mesa/Cad/Vert)', muscleGroup: 'Isquiotibiais', equipmentType: 'Máquina' },
    { name: 'Abdução', muscleGroup: 'Glúteo/Adutores', equipmentType: 'Máquina' },
    { name: 'Glúteo', muscleGroup: 'Glúteo', equipmentType: 'Polia/Máquina' },
    { name: 'Panturrilhas', muscleGroup: 'Panturrilha', equipmentType: 'Livre/Máquina' },
    // Ficha B - Anterior + Core
    { name: 'Supino Vertical', muscleGroup: 'Peitoral', equipmentType: 'Máquina' },
    { name: 'Fly Inclinado', muscleGroup: 'Peitoral Superior', equipmentType: 'Halteres' },
    { name: 'Crucifixo', muscleGroup: 'Peitoral', equipmentType: 'Halteres/Polia' },
    { name: 'Elevação (Front/Lat)', muscleGroup: 'Ombros', equipmentType: 'Halteres' },
    { name: 'Tríceps Testa', muscleGroup: 'Tríceps', equipmentType: 'Barra/Polia' },
    { name: 'Banco', muscleGroup: 'Tríceps', equipmentType: 'Peso Corporal' },
    { name: 'Abdominal', muscleGroup: 'Core', equipmentType: 'Livre' },
    { name: 'Prancha', muscleGroup: 'Core', equipmentType: 'Isometria' },
    // Ficha C - Posterior
    { name: 'Pulley (Rom/Sup)', muscleGroup: 'Dorsal', equipmentType: 'Polia' },
    { name: 'Remada (Baixa/Alta)', muscleGroup: 'Dorsal', equipmentType: 'Polia/Máquina' },
    { name: 'Crucifixo Invertido', muscleGroup: 'Dorsal/Posterior Ombro', equipmentType: 'Polia/Halter' },
    { name: 'Rosca (Dir/Scott)', muscleGroup: 'Bíceps', equipmentType: 'Barra/Halter' },
    { name: 'Rolete', muscleGroup: 'Core/Lombar', equipmentType: 'Roda Abdominal' },
    { name: 'Extensão Lombar', muscleGroup: 'Lombar', equipmentType: 'Banco Romano' },
  ];

  const insertedExercises = await db.insert(exerciseLibrary).values(exercisesToInsert).returning();
  const getExId = (name: string) => insertedExercises.find(e => e.name === name)!.id;

  const templatesToInsert = [
    { name: 'Treino A', description: 'Inferiores' },
    { name: 'Treino B', description: 'Anterior + Core' },
    { name: 'Treino C', description: 'Posterior' },
  ];

  const insertedTemplates = await db.insert(workoutTemplates).values(templatesToInsert).returning();
  
  const templateAId = insertedTemplates.find(t => t.name === 'Treino A')!.id;
  const templateBId = insertedTemplates.find(t => t.name === 'Treino B')!.id;
  const templateCId = insertedTemplates.find(t => t.name === 'Treino C')!.id;

  const itemsToInsert = [
    // Treino A (Amostra de configuração dinâmica)
    { templateId: templateAId, exerciseId: getExId('Extensora'), sets: 4, reps: '10-12', notes: 'Ponto zero 2s' },
    { templateId: templateAId, exerciseId: getExId('Agachamento'), sets: 4, reps: '8-10', notes: 'Foco na amplitude' },
    { templateId: templateAId, exerciseId: getExId('Leg 45 Unilateral'), sets: 3, reps: '10', notes: '' },
    { templateId: templateAId, exerciseId: getExId('Flexora (Mesa/Cad/Vert)'), sets: 4, reps: '10-12', notes: '' },
    // Treino B
    { templateId: templateBId, exerciseId: getExId('Supino Vertical'), sets: 4, reps: '10', notes: 'Atenção ao ombro direito' },
    { templateId: templateBId, exerciseId: getExId('Elevação (Front/Lat)'), sets: 4, reps: '12', notes: 'Carga moderada' },
    { templateId: templateBId, exerciseId: getExId('Prancha'), sets: 3, reps: '60s', notes: 'Isometria máxima' },
    // Treino C
    { templateId: templateCId, exerciseId: getExId('Pulley (Rom/Sup)'), sets: 4, reps: '10-12', notes: '' },
    { templateId: templateCId, exerciseId: getExId('Remada (Baixa/Alta)'), sets: 4, reps: '10', notes: '' },
    { templateId: templateCId, exerciseId: getExId('Rosca (Dir/Scott)'), sets: 4, reps: '10', notes: '' },
  ];

  await db.insert(workoutTemplateItems).values(itemsToInsert);

  // ==========================================
  // 5. DADOS DE TESTE PARA O PDF (MAIO / 2026)
  // ==========================================
  console.log("📊 Injetando dados de teste para o Dossiê (Maio/2026)...");

  const [session1] = await db.insert(workoutSessions).values({
    athleteId,
    date: new Date('2026-05-10T10:00:00Z'),
    durationMinutes: 45
  }).returning();

  const [session2] = await db.insert(workoutSessions).values({
    athleteId,
    date: new Date('2026-05-15T18:30:00Z'),
    durationMinutes: 60
  }).returning();

  await db.insert(treadmillIntervals).values([
    { sessionId: session1.id, distanceMeters: 5000, speedKmh: 10 },
    { sessionId: session2.id, distanceMeters: 8000, speedKmh: 12 }
  ]);

  await db.insert(bioimpedanceLogs).values([
    {
      athleteId,
      date: new Date('2026-05-01T08:00:00Z'),
      weight: 76.5, bodyFat: 25.0, muscleMass: 53.0, bodyWater: 53.5,
      visceralFat: 14.0, metabolicAge: 44, tmb: 1540.0, protein: 17.2,
      boneMass: 3.0, healthNotes: 'Início do mês'
    },
    {
      athleteId,
      date: new Date('2026-05-21T05:19:00Z'), // Usando o dado real do seu print!
      weight: 74.5, bodyFat: 23.8, muscleMass: 53.7, bodyWater: 54.3,
      visceralFat: 13.5, metabolicAge: 43, tmb: 1543.8, protein: 17.8,
      boneMass: 3.1, healthNotes: 'Dado real via Telegram Webhook'
    }
  ]);

  console.log("✅ Seed finalizado com sucesso.");
}

if (require.main === module) {
  seed().catch(console.error);
}