import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { plannedWorkouts } from '../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { athleteRepository } from '../repositories/athleteRepository';

async function runUpdate() {
  console.log('⏳ Iniciando atualização de aquecimentos e desaquecimentos...');

  const athlete = await athleteRepository.getPrimaryAthlete();
  if (!athlete) throw new Error('Atleta não encontrado');

  const csvPath = path.join(process.cwd(), 'Plano_Matriz_Definitiva_Nike_SP.csv');
  const csvData = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvData.split('\n').filter(l => l.trim().length > 0);

  // Pula a primeira linha (cabeçalho)
  for (let i = 1; i < lines.length; i++) {
    // Regex matador para dar split por vírgula respeitando aspas (ex: "10,3 km/h")
    const columns = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.trim().replace(/^"|"$/g, ''));
    
    if (columns.length < 6) continue;

    const dateStr = columns[0];
    const warmupStr = columns[3]; // AQ
    const cooldownStr = columns[5]; // DQ

    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/');
      const targetDate = new Date(Number(year), Number(month) - 1, Number(day));
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const warmup = (warmupStr === '-' || !warmupStr) ? null : warmupStr;
      const cooldown = (cooldownStr === '-' || !cooldownStr) ? null : cooldownStr;

      if (warmup || cooldown) {
        await db.update(plannedWorkouts)
          .set({ warmup, cooldown })
          .where(
            and(
              eq(plannedWorkouts.athleteId, athlete.id),
              eq(plannedWorkouts.activityType, 'RUN'),
              gte(plannedWorkouts.date, startOfDay),
              lte(plannedWorkouts.date, endOfDay)
            )
          );
        console.log(`✅ ${dateStr} atualizado: AQ [${warmup}] | DQ [${cooldown}]`);
      }
    }
  }

  console.log('🎉 Tudo pronto! BD atualizado com sucesso.');
  process.exit(0);
}

runUpdate().catch(console.error);