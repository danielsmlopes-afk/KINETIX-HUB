import { db } from '../src/db';
import { athletes, plannedWorkouts } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day), 6, 0, 0); // 06:00
}

async function main() {
  console.log('[Import] Buscando o atleta Daniel...');
  const athleteList = await db.select().from(athletes).where(eq(athletes.name, 'Daniel')).limit(1);
  const athlete = athleteList.length > 0 ? athleteList[0] : (await db.select().from(athletes).limit(1))[0];

  if (!athlete) {
    console.error('Atleta não encontrado no banco.');
    process.exit(1);
  }
  
  console.log(`[Import] Atleta: ${athlete.name} (${athlete.id})`);

  console.log('[Import] Lendo dados do treino...');
  const filePath = path.join(__dirname, 'treino.json');
  const treinoData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log(`[Import] Inserindo ${treinoData.length} dias de treino...`);

  let count = 0;
  for (const day of treinoData) {
    const date = parseDate(day.data);
    const activityType = day.status === 'LOCKED' || day.pace_alvo_min_km.includes('OFF') ? 'REST' : (day.status === 'GOAL' || day.status === 'SIMULADO' ? 'RACE' : 'RUN');
    
    let title = `${day.status}`;
    if (day.pace_alvo_min_km !== 'OFF') {
      title += ` | Pace: ${day.pace_alvo_min_km}`;
    }
    if (day.serie_liquida_km > 0) {
      title += ` | ${day.serie_liquida_km}km`;
    }
    
    const details: any = {};
    if (day.academia !== 'OFF') details.strength = `Academia: ${day.academia}`;
    if (day.bike_min > 0) details.bike = `Bike: ${day.bike_min} min`;
    if (day.warmup_km > 0) details.warmup = `Aquecimento: ${day.warmup_km}km @ ${day.warmup_speed_kmh}km/h`;
    if (day.cooldown_km > 0) details.cooldown = `Desaquecimento: ${day.cooldown_km}km @ ${day.cooldown_speed_kmh}km/h`;
    
    if (day.serie_liquida_km > 0) {
      let paceStr = day.pace_alvo_min_km;
      // Convert MM:SS to range MM:SS - MM:SS+15
      const paceMatch = /^(\d{2}):(\d{2})$/.exec(paceStr);
      if (paceMatch) {
        let m = parseInt(paceMatch[1], 10);
        let s = parseInt(paceMatch[2], 10);
        s += 15;
        if (s >= 60) {
          s -= 60;
          m += 1;
        }
        const mStr = m.toString().padStart(2, '0');
        const sStr = s.toString().padStart(2, '0');
        paceStr = `${paceStr} - ${mStr}:${sStr}`;
      }
      details.corrida = `${day.serie_liquida_km}km | ${paceStr}`;
    }

    await db.insert(plannedWorkouts).values({
      athleteId: athlete.id,
      date: date,
      activityType: activityType,
      title: title,
      phase: day.fase,
      mesocycleStage: 1, // default or parsed from fase
      isImported: true,
      details: Object.keys(details).length > 0 ? details : null,
    });
    count++;
  }

  console.log(`[Import] Concluído com sucesso! Foram inseridos ${count} treinos.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
