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
  const existingShoes = await db.select().from(shoes).limit(1);
  if (existingShoes.length === 0) {
    await db.insert(shoes).values([
      { name: 'Fila Carbon Racer 3', stravaGearId: 'g12345' }, // Atualizado para sua preferência
      { name: 'Olympikus Corre', stravaGearId: 'g67890' }
    ]);
  }

  const existingConsumables = await db.select().from(consumables).limit(1);
  if (existingConsumables.length === 0) {
    await db.insert(consumables).values([
      { type: 'gel', name: 'Gel Z2', currentStock: 10, alertThreshold: 3 },
      { type: 'salt', name: 'Cápsula de Sal', currentStock: 30, alertThreshold: 5 }
    ]);
  }

  // ==========================================
  // 3. BACKLOG DE PROVAS (PERENE)
  // ==========================================
  const existingRaces = await db.select().from(races).limit(1);
  if (existingRaces.length === 0) {
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
  }

  // ==========================================
  // 4. CORE DE FORÇA: IRONLOG_V2 (REALIDADE)
  // ==========================================
  console.log("🧹 Limpando Biblioteca de Exercícios e Fichas antigas para atualização...");
  await db.delete(workoutTemplateItems);
  await db.delete(workoutTemplates);
  await db.delete(exerciseLibrary);

  console.log("🏋️ Inserindo Biblioteca de Exercícios e Fichas IronLog_V2...");
  
  const exercisesToInsert = [
    // Ficha A - Inferiores
    { name: 'Agachamento Hack', muscleGroup: 'Quadríceps', equipmentType: 'Máquina' },
    { name: 'Agachamento Sumô', muscleGroup: 'Glúteos/Adutores', equipmentType: 'Halteres' },
    { name: 'Cadeira Extensora', muscleGroup: 'Quadríceps', equipmentType: 'Máquina' },
    { name: 'Mesa Flexora', muscleGroup: 'Isquiotibiais', equipmentType: 'Máquina' },
    { name: 'Stiff', muscleGroup: 'Isquiotibiais/Glúteos', equipmentType: 'Barra' },
    { name: 'Cadeira Flexora', muscleGroup: 'Isquiotibiais', equipmentType: 'Máquina' },
    { name: 'Abdução com Tornozeleira', muscleGroup: 'Glúteos', equipmentType: 'Polia/Livre' },
    { name: 'Elevação Pélvica', muscleGroup: 'Glúteos', equipmentType: 'Bosu/Livre' },
    { name: 'Panturrilha Equip 15', muscleGroup: 'Panturrilhas', equipmentType: 'Máquina' },
    { name: 'Panturrilha Equip 21', muscleGroup: 'Panturrilhas', equipmentType: 'Máquina' },
    // Ficha B - Anterior + Core
    { name: 'Fly Reto', muscleGroup: 'Peitoral', equipmentType: 'Halteres' },
    { name: 'Supino Inclinado', muscleGroup: 'Peitoral Superior', equipmentType: 'Máquina' },
    { name: 'Cross Over Polia Média', muscleGroup: 'Peitoral', equipmentType: 'Polia' },
    { name: 'Elevação Frontal', muscleGroup: 'Ombros', equipmentType: 'Halteres/Livre' },
    { name: 'Desenvolvimento H', muscleGroup: 'Ombros', equipmentType: 'Halteres' },
    { name: 'Tríceps Pulley', muscleGroup: 'Tríceps', equipmentType: 'Polia' },
    { name: 'Tríceps Testa', muscleGroup: 'Tríceps', equipmentType: 'Halteres' },
    { name: 'Abdominal', muscleGroup: 'Core', equipmentType: 'Máquina/Livre' },
    { name: 'Prancha Abdominal', muscleGroup: 'Core', equipmentType: 'Colchonete' },
    // Ficha C - Posterior
    { name: 'Pulley Frente', muscleGroup: 'Dorsal', equipmentType: 'Máquina' },
    { name: 'Remada Cavalinho', muscleGroup: 'Dorsal', equipmentType: 'Máquina Livre' },
    { name: 'Pulldown', muscleGroup: 'Dorsal', equipmentType: 'Polia' },
    { name: 'Face Pulldown', muscleGroup: 'Dorsal/Posterior', equipmentType: 'Polia' },
    { name: 'Crucifixo Invertido', muscleGroup: 'Posterior Ombro', equipmentType: 'Máquina' },
    { name: 'Rosca Direta', muscleGroup: 'Bíceps', equipmentType: 'Halteres' },
    { name: 'Rosca Martelo', muscleGroup: 'Bíceps', equipmentType: 'Halteres/Polia' },
    { name: 'Rolete de Punho', muscleGroup: 'Antebraço', equipmentType: 'Acessório' },
    { name: 'Extensão Lombar', muscleGroup: 'Lombar', equipmentType: 'Banco' },
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
    // Treino A
    { templateId: templateAId, exerciseId: getExId('Agachamento Hack'), sets: 4, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateAId, exerciseId: getExId('Agachamento Sumô'), sets: 4, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateAId, exerciseId: getExId('Cadeira Extensora'), sets: 4, reps: '10+10iso', notes: 'Pausa: 01:00' },
    { templateId: templateAId, exerciseId: getExId('Mesa Flexora'), sets: 4, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateAId, exerciseId: getExId('Stiff'), sets: 4, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateAId, exerciseId: getExId('Cadeira Flexora'), sets: 4, reps: '10+10iso', notes: 'Pausa: 01:00' },
    { templateId: templateAId, exerciseId: getExId('Abdução com Tornozeleira'), sets: 4, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateAId, exerciseId: getExId('Elevação Pélvica'), sets: 4, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateAId, exerciseId: getExId('Panturrilha Equip 15'), sets: 4, reps: '15', notes: 'Pausa: 01:00' },
    { templateId: templateAId, exerciseId: getExId('Panturrilha Equip 21'), sets: 4, reps: '15', notes: 'Pausa: 01:00' },
    // Treino B
    { templateId: templateBId, exerciseId: getExId('Fly Reto'), sets: 4, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateBId, exerciseId: getExId('Supino Inclinado'), sets: 4, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateBId, exerciseId: getExId('Cross Over Polia Média'), sets: 4, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateBId, exerciseId: getExId('Elevação Frontal'), sets: 4, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateBId, exerciseId: getExId('Desenvolvimento H'), sets: 4, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateBId, exerciseId: getExId('Tríceps Pulley'), sets: 4, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateBId, exerciseId: getExId('Tríceps Testa'), sets: 4, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateBId, exerciseId: getExId('Abdominal'), sets: 4, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateBId, exerciseId: getExId('Prancha Abdominal'), sets: 3, reps: '40s', notes: 'Pausa: 01:00' },
    // Treino C
    { templateId: templateCId, exerciseId: getExId('Pulley Frente'), sets: 3, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateCId, exerciseId: getExId('Remada Cavalinho'), sets: 3, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateCId, exerciseId: getExId('Pulldown'), sets: 3, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateCId, exerciseId: getExId('Face Pulldown'), sets: 3, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateCId, exerciseId: getExId('Crucifixo Invertido'), sets: 3, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateCId, exerciseId: getExId('Rosca Direta'), sets: 3, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateCId, exerciseId: getExId('Rosca Martelo'), sets: 3, reps: '10', notes: 'Pausa: 01:00' },
    { templateId: templateCId, exerciseId: getExId('Rolete de Punho'), sets: 3, reps: '1 volta', notes: 'Pausa: 01:00' },
    { templateId: templateCId, exerciseId: getExId('Extensão Lombar'), sets: 3, reps: '10', notes: 'Pausa: 01:00' },
  ];

  await db.insert(workoutTemplateItems).values(itemsToInsert);

  // ==========================================
  // 5. DADOS DE TESTE PARA O PDF (MAIO / 2026)
  // ==========================================
  console.log("📊 Injetando dados de teste para o Dossiê (Maio/2026)...");

  const existingSessions = await db.select().from(workoutSessions).limit(1);
  if (existingSessions.length === 0) {
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
  }

  const existingBioLogs = await db.select().from(bioimpedanceLogs).limit(1);
  if (existingBioLogs.length === 0) {
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
  }

  console.log("✅ Seed finalizado com sucesso.");
}

if (require.main === module) {
  seed().catch(console.error);
}