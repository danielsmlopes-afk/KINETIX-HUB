import 'dotenv/config';
import { db } from '../db';
import { plannedWorkouts } from '../db/schema';
import { athleteRepository } from '../repositories/athleteRepository';
import { eq } from 'drizzle-orm';

const workoutsData = [
  { date: '2026-05-23', type: 'RUN', title: 'Corrida Leve', details: { corrida: '5km @ 07:20 (8,2 km/h)' } },
  { date: '2026-05-23', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha C (Posterior + Core)' } },
  { date: '2026-05-24', type: 'RUN', title: 'Longão', details: { corrida: '14km @ 06:46 (1h34 - Concluído!)' } },
  { date: '2026-05-25', type: 'REST', title: 'DESCANSO ABSOLUTO', details: { corrida: 'OFF' } },
  { date: '2026-05-26', type: 'RUN_INTERVAL', title: 'Tiros Longos', warmup: '2.0 km @ 6,5 km/h', cooldown: '1.0 km @ 4,5 km/h', details: { corrida: '5x800m @ 10,3 km/h (Feito!)', restDetails: "1'15\" Passivo (Pé de lado)" } },
  { date: '2026-05-26', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha B (Anterior + Core)' } },
  { date: '2026-05-27', type: 'REST', title: 'DESCANSO COMPENSATÓRIO', details: { corrida: 'OFF' } },
  { date: '2026-05-28', type: 'RUN', title: 'Corrida Leve', details: { corrida: '8km @ 07:10 (8,4 km/h) [Entrada Direta]' } },
  { date: '2026-05-28', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha A (Membros Inferiores)' } },
  { date: '2026-05-29', type: 'REST', title: 'DESCANSO ABSOLUTO', details: { corrida: 'OFF' } },
  { date: '2026-05-30', type: 'RUN', title: 'Corrida Leve', details: { corrida: '6km @ 07:20 (8,2 km/h) [Entrada Direta]' } },
  { date: '2026-05-30', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha C (Posterior + Core)' } },
  { date: '2026-05-31', type: 'RUN', title: 'Longão', details: { corrida: '15km @ 06:50 (8,8 km/h ou Rua)' } },
  { date: '2026-06-01', type: 'REST', title: 'DESCANSO ABSOLUTO', details: { corrida: 'OFF' } },
  { date: '2026-06-02', type: 'RUN_INTERVAL', title: 'Tiros Curtos', warmup: '2.0 km @ 6,5 km/h', cooldown: '1.5 km @ 4,5 km/h', details: { corrida: '8x400m @ 10,6 km/h (Pace 05:40)', restDetails: "1'00\" Passivo (Pé de lado)" } },
  { date: '2026-06-02', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha B (Anterior + Core)' } },
  { date: '2026-06-03', type: 'RUN', title: 'Corrida Leve', details: { corrida: '8km @ 07:05 (8,5 km/h) [Entrada Direta]' } },
  { date: '2026-06-03', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha A (Membros Inferiores)' } },
  { date: '2026-06-04', type: 'RUN', title: 'Corrida Regen', details: { corrida: '8km @ 08:00 (7,5 km/h) [Entrada Direta]' } },
  { date: '2026-06-04', type: 'BIKE', title: 'Giro Livre', details: { bike: '50min Giro Livre indolor' } },
  { date: '2026-06-05', type: 'REST', title: 'DESCANSO ABSOLUTO', details: { corrida: 'OFF' } },
  { date: '2026-06-06', type: 'RUN', title: 'Corrida Leve', details: { corrida: '6km @ 07:20 (8,2 km/h) [Entrada Direta]' } },
  { date: '2026-06-06', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha C (Posterior + Core)' } },
  { date: '2026-06-07', type: 'RUN', title: 'Longão Progressivo', details: { corrida: '16km @ 06:50 -> final 06:30 (9,2 km/h)' } },
  { date: '2026-06-08', type: 'REST', title: 'DESCANSO ABSOLUTO', details: { corrida: 'OFF' } },
  { date: '2026-06-09', type: 'RUN_INTERVAL', title: 'Série Limiar', warmup: '2.0 km @ 6,5 km/h', cooldown: '1.5 km @ 4,5 km/h', details: { corrida: '4x1km @ 10,1 km/h (Pace 05:55)', restDetails: "2'00\" Ativo (Esteira a 3,0 km/h)" } },
  { date: '2026-06-09', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha B (Anterior + Core)' } },
  { date: '2026-06-10', type: 'RUN', title: 'Corrida Leve', details: { corrida: '8km @ 07:05 (8,5 km/h) [Entrada Direta]' } },
  { date: '2026-06-10', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha A (Membros Inferiores)' } },
  { date: '2026-06-11', type: 'RUN', title: 'Corrida Regen', details: { corrida: '8km @ 08:00 (7,5 km/h) [Entrada Direta]' } },
  { date: '2026-06-11', type: 'BIKE', title: 'Giro Livre', details: { bike: '55min Giro Livre indolor' } },
  { date: '2026-06-12', type: 'REST', title: 'DESCANSO ABSOLUTO', details: { corrida: 'OFF' } },
  { date: '2026-06-13', type: 'RUN', title: 'Corrida Leve', details: { corrida: '5km @ 07:20 (8,2 km/h) [Entrada Direta]' } },
  { date: '2026-06-13', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha C (Posterior + Core)' } },
  { date: '2026-06-14', type: 'REST', title: 'DESCANSO ABSOLUTO', details: { corrida: 'OFF' } },
  { date: '2026-06-15', type: 'RUN', title: 'Longão Regenerativo', details: { corrida: '12km @ 07:15 (8,3 km/h)' } },
  { date: '2026-06-16', type: 'RUN_INTERVAL', title: 'Volume Tiros', warmup: '2.0 km @ 6,5 km/h', cooldown: '1.5 km @ 4,5 km/h', details: { corrida: '6x400m @ 10,6 km/h (Pace 05:40)', restDetails: "1'00\" Passivo (Pé de lado)" } },
  { date: '2026-06-16', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha B (Anterior + Core)' } },
  { date: '2026-06-17', type: 'RUN', title: 'Corrida Leve', details: { corrida: '8km @ 07:05 (8,5 km/h) [Entrada Direta]' } },
  { date: '2026-06-17', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha A (Membros Inferiores)' } },
  { date: '2026-06-18', type: 'RUN', title: 'Corrida Regen', details: { corrida: '8km @ 08:00 (7,5 km/h) [Entrada Direta]' } },
  { date: '2026-06-18', type: 'BIKE', title: 'Giro Livre', details: { bike: '60min Giro Livre indolor' } },
  { date: '2026-06-19', type: 'REST', title: 'DESCANSO ABSOLUTO', details: { corrida: 'OFF' } },
  { date: '2026-06-20', type: 'RUN', title: 'Corrida Leve', details: { corrida: '6km @ 07:20 (8,2 km/h) [Entrada Direta]' } },
  { date: '2026-06-20', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha C (Posterior + Core)' } },
  { date: '2026-06-21', type: 'RUN', title: 'Longão Volume Especial', details: { corrida: '18km @ 06:45 (8,9 km/h)' } },
  { date: '2026-06-22', type: 'REST', title: 'DESCANSO ABSOLUTO', details: { corrida: 'OFF' } },
  { date: '2026-06-23', type: 'RUN_INTERVAL', title: 'Limiar II', warmup: '2.0 km @ 6,5 km/h', cooldown: '1.5 km @ 4,5 km/h', details: { corrida: '5x1km @ 10,3 km/h (Pace 05:50)', restDetails: "2'00\" Ativo (Esteira a 3,0 km/h)" } },
  { date: '2026-06-23', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha B (Anterior + Core)' } },
  { date: '2026-06-24', type: 'RUN', title: 'Corrida Leve', details: { corrida: '8km @ 07:00 (8,6 km/h) [Entrada Direta]' } },
  { date: '2026-06-24', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha A (Membros Inferiores)' } },
  { date: '2026-06-25', type: 'RUN', title: 'Corrida Regen', details: { corrida: '8km @ 08:00 (7,5 km/h) [Entrada Direta]' } },
  { date: '2026-06-25', type: 'BIKE', title: 'Giro Livre', details: { bike: '60min Giro Livre indolor' } },
  { date: '2026-06-26', type: 'REST', title: 'DESCANSO ABSOLUTO', details: { corrida: 'OFF' } },
  { date: '2026-06-27', type: 'RUN', title: 'Corrida Leve', details: { corrida: '5km @ 07:20 (8,2 km/h) [Entrada Direta]' } },
  { date: '2026-06-27', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha C (Posterior + Core)' } },
  { date: '2026-06-28', type: 'RUN', title: 'Longão Ápice', details: { corrida: '20km @ 06:45 -> final 06:30 (9,2 km/h)' } },
  { date: '2026-06-29', type: 'REST', title: 'DESCANSO ABSOLUTO', details: { corrida: 'OFF' } },
  { date: '2026-06-30', type: 'RUN_INTERVAL', title: 'Tiros de Ajuste', warmup: '2.0 km @ 6,5 km/h', cooldown: '1.5 km @ 4,5 km/h', details: { corrida: '8x400m @ 10,4 km/h (Pace 05:45)', restDetails: "1'00\" Passivo (Pé de lado)" } },
  { date: '2026-06-30', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha B (Anterior + Core)' } },
  { date: '2026-07-01', type: 'RUN', title: 'Corrida Leve', details: { corrida: '8km @ 07:05 (8,5 km/h) [Entrada Direta]' } },
  { date: '2026-07-01', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha A (Membros Inferiores)' } },
  { date: '2026-07-02', type: 'RUN', title: 'Corrida Regen', details: { corrida: '8km @ 08:00 (7,5 km/h) [Entrada Direta]' } },
  { date: '2026-07-02', type: 'BIKE', title: 'Giro Livre', details: { bike: '45min Giro Livre indolor' } },
  { date: '2026-07-03', type: 'REST', title: 'DESCANSO ABSOLUTO', details: { corrida: 'OFF' } },
  { date: '2026-07-04', type: 'RUN', title: 'Corrida Leve', details: { corrida: '5km @ 07:20 (8,2 km/h) [Entrada Direta]' } },
  { date: '2026-07-04', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha C (Posterior + Core)' } },
  { date: '2026-07-05', type: 'RUN', title: 'Longão Taper 1', details: { corrida: '16km @ 06:50 (8,8 km/h)' } },
  { date: '2026-07-06', type: 'REST', title: 'DESCANSO ABSOLUTO', details: { corrida: 'OFF' } },
  { date: '2026-07-07', type: 'RUN_INTERVAL', title: 'Cruzeiro Final', warmup: '2.0 km @ 6,5 km/h', cooldown: '1.5 km @ 4,5 km/h', details: { corrida: '3x2km @ 9,7 km/h (Pace 06:10)', restDetails: "2'00\" Ativo (Esteira a 3,0 km/h)" } },
  { date: '2026-07-07', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha B (Anterior + Core)' } },
  { date: '2026-07-08', type: 'RUN', title: 'Corrida Leve', details: { corrida: '7km @ 07:15 (8,3 km/h) [Entrada Direta]' } },
  { date: '2026-07-08', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha A (Membros Inferiores)' } },
  { date: '2026-07-09', type: 'RUN', title: 'Corrida Regen', details: { corrida: '6km @ 08:00 (7,5 km/h) [Entrada Direta]' } },
  { date: '2026-07-09', type: 'BIKE', title: 'Giro Livre', details: { bike: '40min Giro Livre indolor' } },
  { date: '2026-07-10', type: 'RUN', title: 'Polimento Final ProCoach', details: { corrida: 'Manutenção em Z2 curta (Sem AQ/DQ)' } },
  { date: '2026-07-10', type: 'STRENGTH', title: 'Treinos de Carga Leve', details: { academia: 'Treinos de Carga Leve' } },
  { date: '2026-07-26', type: 'RACE', title: 'NIKE SP CITY MARATHON', warmup: 'Mobilidade', cooldown: 'Caminhada', details: { corrida: '21,097 km @ Meta 06:30 (9,2 km/h)', restDetails: "FOCO SUB 2h20" } }
];

async function seed() {
  const athlete = await athleteRepository.getPrimaryAthlete();
  if (!athlete) throw new Error('Atleta não encontrado.');

  console.log(`🧹 Limpando planilha atual do atleta ${athlete.name}...`);
  await db.delete(plannedWorkouts).where(eq(plannedWorkouts.athleteId, athlete.id));

  console.log('🌱 Inserindo novos treinos desmembrados...');
  // Limiar temporal (Tudo anterior a 14/06/2026 será VALIDATED)
  const limitDate = new Date('2026-06-14T23:59:59Z');

  const insertData = workoutsData.map(w => {
    const wDate = new Date(w.date + 'T12:00:00Z');
    const status = wDate.getTime() <= limitDate.getTime() ? 'VALIDATED' : 'PENDING';

    return {
      athleteId: athlete.id,
      date: wDate,
      activityType: w.type,
      title: w.title,
      warmup: w.warmup || null,
      cooldown: w.cooldown || null,
      details: w.details || {},
      complianceStatus: status,
      isImported: true
    };
  });

  await db.insert(plannedWorkouts).values(insertData);
  console.log(`✅ ${insertData.length} operações táticas injetadas com sucesso!`);
  
  // Hack tático para Windows: Aguarda o I/O de rede fechar suavemente antes de derrubar o processo
  setTimeout(() => process.exit(0), 500);
}

seed().catch(err => {
  console.error('❌ Erro:', err);
  setTimeout(() => process.exit(1), 500);
});
