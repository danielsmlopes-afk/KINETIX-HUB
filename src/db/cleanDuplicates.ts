import { db } from './index';
import { bioimpedanceLogs, plannedWorkouts } from './schema';
import { eq } from 'drizzle-orm';

async function clean() {
  console.log('🧹 Iniciando varredura por dados duplicados...');

  // 1. Limpar Bioimpedâncias Duplicadas
  const bios = await db.select().from(bioimpedanceLogs);
  const bioSeen = new Set<string>();
  let bioDeleted = 0;

  for (const bio of bios) {
    const key = `${bio.athleteId}-${bio.date.toISOString()}`;
    if (bioSeen.has(key)) {
      await db.delete(bioimpedanceLogs).where(eq(bioimpedanceLogs.id, bio.id));
      bioDeleted++;
    } else {
      bioSeen.add(key);
    }
  }
  console.log(`✅ Bioimpedâncias duplicadas removidas: ${bioDeleted}`);

  // 2. Limpar Treinos Planejados Duplicados
  const workouts = await db.select().from(plannedWorkouts);
  const workoutSeen = new Set<string>();
  let workoutDeleted = 0;

  for (const w of workouts) {
    const key = `${w.athleteId}-${w.date.toISOString()}-${w.activityType}-${w.title}`;
    if (workoutSeen.has(key)) {
      await db.delete(plannedWorkouts).where(eq(plannedWorkouts.id, w.id));
      workoutDeleted++;
    } else {
      workoutSeen.add(key);
    }
  }
  console.log(`✅ Treinos duplicados removidos: ${workoutDeleted}`);
  console.log('✨ Limpeza concluída com sucesso!');
}

clean().catch(console.error);