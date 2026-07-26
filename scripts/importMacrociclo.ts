import { db } from '../src/db';
import { athletes, plannedWorkouts, races } from '../src/db/schema';
import { eq } from 'drizzle-orm';

function parseDate(dateStr: string, timeStr: string): Date {
  const [day, month, year] = dateStr.split('/');
  const [hour, minute] = timeStr.split(':');
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const macrociclo = [
  { s: 1, start: '27/07/2026', t: 'OFF (Pós-Nike)', w: 'Corrida 6 km Easy', th: 'Corrida 6 km Regen', sa: 'Corrida 5 km Leve', su: 'Corrida 8 km', focus: 'Recuperação Ativa pós-Nike' },
  { s: 2, start: '03/08/2026', t: 'AQ 2km + 4x800m @ 10,2 km/h + DQ 1km', w: 'Corrida 8 km Easy', th: 'Corrida 8 km Regen + Bike 45 min', sa: 'Corrida 5 km Leve', su: 'Corrida 12 km', focus: 'Retomada mecânica gradual' },
  { s: 3, start: '10/08/2026', t: 'AQ 2km + 5x800m @ 10,6 km/h + DQ 1km', w: 'Corrida 8 km Easy', th: 'Corrida 8 km Regen + Bike 50 min', sa: 'Corrida 5 km Leve', su: 'Corrida 14 km (Final 06:00)', focus: 'Construção de Velocidade Sustentada' },
  { s: 4, start: '17/08/2026', t: 'AQ 2km + 6x800m @ 10,8 km/h + DQ 1km', w: 'Corrida 8 km Easy', th: 'Corrida 8 km Regen + Bike 50 min', sa: 'Corrida 6 km Leve', su: 'Corrida 16 km (@ 06:05)', focus: 'Resistência de Limiar Aeróbico' },
  { s: 5, start: '24/08/2026', t: 'AQ 2km + 4x1km @ 10,6 km/h + DQ 1km', w: 'Corrida 8 km Easy', th: 'Corrida 8 km Regen + Bike 55 min', sa: 'Corrida 5 km Leve', su: '18 km Simulado (Pace: 05:55)', focus: 'O Grande Simulado Praia Grande' },
  { s: 6, start: '31/08/2026', t: 'AQ 2km + 6x400m @ 11,0 km/h + DQ 1,5km', w: 'Corrida 6 km Easy', th: 'Corrida 6 km Regen + Bike 45 min', sa: 'Corrida 5 km Leve', su: 'Corrida 12 km (@ 06:20)', focus: 'Semana de Descarga Tática' },
  { s: 7, start: '07/09/2026', t: 'AQ 2km + 5x1km @ 10,6 km/h + DQ 1km', w: 'Corrida 8 km Easy', th: 'Corrida 8 km Regen + Bike 50 min', sa: 'Corrida 5 km Leve', su: 'Corrida 14 km (@ 05:55)', focus: 'Pico de Consistência de Ritmo' },
  { s: 8, start: '14/09/2026', t: 'AQ 1.5km + 4x400m @ 10,8 km/h + DQ 1km', w: 'Corrida 6 km Easy', th: 'Corrida 5 km Regen + Bike 35 min', sa: 'Corrida 4 km Solto', su: 'Corrida 8 km (Polimento)', focus: 'Tapering Praia Grande' },
  { s: 9, start: '21/09/2026', t: 'Ativação 4km (3 tiros curtos)', w: 'OFF TOTAL', th: 'Corrida 2 km Giro', sa: 'OFF (Carb-loading)', su: 'PROVA ALVO 1: MEIA PRAIA GRANDE', focus: 'BUSCAR SUB-2H05 NO LITORAL!' },
  { s: 10, start: '28/09/2026', t: 'OFF (Pós-PG)', w: 'Corrida 6 km Easy', th: 'Corrida 6 km Regen + Bike 45 min', sa: 'Corrida 5 km Leve', su: 'Corrida 12 km (@ 06:15)', focus: 'Ponte Tática / Transição Ativa' },
  { s: 11, start: '05/10/2026', t: 'AQ 1.5km + 3x1km @ 10,6 km/h + DQ 1km', w: 'Corrida 6 km Easy', th: 'Corrida 4 km Regen + Bike 30 min', sa: 'Corrida 4 km Leve', su: 'Corrida 8 km (Polimento)', focus: 'Red Zone / Ativação de Pico' },
  { s: 12, start: '12/10/2026', t: 'Ativação 4km (3 tiros curtos)', w: 'OFF TOTAL', th: 'Corrida 2 km Giro', sa: 'OFF (Carb-loading)', su: 'PROVA ALVO 2: MIZUNO ATHENAS', focus: 'CONSOLIDAÇÃO E RECORDES!' },
];

async function main() {
  console.log('[Import] Buscando o atleta Daniel...');
  const athleteList = await db.select().from(athletes).where(eq(athletes.name, 'Daniel')).limit(1);
  const athlete = athleteList.length > 0 ? athleteList[0] : (await db.select().from(athletes).limit(1))[0];

  if (!athlete) {
    console.error('Atleta não encontrado no banco.');
    process.exit(1);
  }
  
  console.log(`[Import] Atleta: ${athlete.name} (${athlete.id})`);

  // Inserir Provas
  console.log('[Import] Inserindo provas...');
  const datePG = parseDate('27/09/2026', '06:00');
  await db.insert(races).values({
    category: 'HALF_MARATHON',
    date: datePG,
    distance: 21.1,
    startTime: '06:00',
    startLocation: 'Praia Grande, SP',
    name: '14ª Meia Maratona Praia Grande',
    isTarget: true,
    targetPace: '05:55',
  }).onConflictDoNothing();

  const dateAthenas = parseDate('18/10/2026', '06:00');
  await db.insert(races).values({
    category: 'HALF_MARATHON',
    date: dateAthenas,
    distance: 21.1,
    startTime: '06:00',
    startLocation: 'São Paulo, SP',
    name: 'Mizuno Athenas Run Longer 2026',
    isTarget: true,
    targetPace: '05:45', // Sub-2h02 approx
  }).onConflictDoNothing();

  console.log('[Import] Inserindo plano de treinos...');

  for (const week of macrociclo) {
    const monday = parseDate(week.start, '06:00');
    
    // Segunda (OFF - Descanso Absoluto)
    const d1 = monday;
    await addWorkout(athlete.id, d1, 'REST', 'Descanso Absoluto (LOCKED)', week.focus, week.s);
    
    // Terça (Tiros + Ficha B)
    const d2 = addDays(monday, 1);
    await addWorkout(athlete.id, d2, week.t.includes('OFF') ? 'REST' : 'RUN', week.t, week.focus, week.s, 'Musculação: Ficha B (Anterior + Core)');

    // Quarta (Easy + Ficha A)
    const d3 = addDays(monday, 2);
    await addWorkout(athlete.id, d3, week.w.includes('OFF') ? 'REST' : 'RUN', week.w, week.focus, week.s, 'Musculação: Ficha A (Inferiores)');

    // Quinta (Regen + Bike)
    const d4 = addDays(monday, 3);
    await addWorkout(athlete.id, d4, week.th.includes('OFF') ? 'REST' : 'RUN', week.th, week.focus, week.s);

    // Sexta (OFF - Descanso Absoluto)
    const d5 = addDays(monday, 4);
    await addWorkout(athlete.id, d5, 'REST', 'Descanso Absoluto (LOCKED)', week.focus, week.s);

    // Sábado (Leve + Ficha C)
    const d6 = addDays(monday, 5);
    await addWorkout(athlete.id, d6, week.sa.includes('OFF') ? 'REST' : 'RUN', week.sa, week.focus, week.s, 'Musculação: Ficha C (Posterior + Core)');

    // Domingo (Longão)
    const d7 = addDays(monday, 6);
    await addWorkout(athlete.id, d7, week.su.includes('PROVA') ? 'RACE' : 'RUN', week.su, week.focus, week.s);
  }

  console.log('[Import] Concluído com sucesso!');
  process.exit(0);
}

async function addWorkout(athleteId: string, date: Date, activityType: string, title: string, phase: string, stage: number, strength?: string) {
  const details = strength ? { instructions: strength } : {};
  await db.insert(plannedWorkouts).values({
    athleteId,
    date,
    activityType,
    title,
    phase,
    mesocycleStage: stage,
    isImported: true,
    details
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
