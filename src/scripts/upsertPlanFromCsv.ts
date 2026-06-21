import 'dotenv/config';
import { db } from '../db';
import { plannedWorkouts } from '../db/schema';
import { athleteRepository } from '../repositories/athleteRepository';
import { eq, and, sql } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento COMPLETO do CSV Kinetix_V11_Premium_Com_Fases.csv
// Cada item pode gerar 1 ou 2 treinos (ex: corrida + academia)
// ─────────────────────────────────────────────────────────────────────────────
interface WorkoutEntry {
  date: string;
  phase: string;
  type: string;
  title: string;
  warmup?: string;
  cooldown?: string;
  details: Record<string, string>;
}

const csvWorkouts: WorkoutEntry[] = [
  // ── FASE 1: BASE ──────────────────────────────────────────────────────────
  { date: '2026-05-23', phase: 'Fase 1: Base', type: 'RUN',          title: 'Corrida Leve',         details: { corrida: '5km @ 07:20 (8,2 km/h)' } },
  { date: '2026-05-23', phase: 'Fase 1: Base', type: 'STRENGTH',     title: 'Treino de Força',      details: { academia: 'Ficha C (Posterior + Core)' } },
  { date: '2026-05-24', phase: 'Fase 1: Base', type: 'RUN',          title: 'Longão',               details: { corrida: '14km @ 06:46 (1h34 - Concluído!)' } },
  { date: '2026-05-25', phase: 'Fase 1: Base', type: 'REST',         title: 'DESCANSO ABSOLUTO',    details: { corrida: 'OFF' } },
  { date: '2026-05-26', phase: 'Fase 1: Base', type: 'RUN_INTERVAL', title: 'Tiros Longos',         warmup: '2.0 km @ 6.5 km/h', cooldown: '1.0 km @ 4.5 km/h', details: { corrida: '5x800m @ 10,3 km/h (Feito!)', restDetails: "1'15\" Passivo" } },
  { date: '2026-05-26', phase: 'Fase 1: Base', type: 'STRENGTH',     title: 'Treino de Força',      details: { academia: 'Ficha B (Anterior + Core)' } },
  { date: '2026-05-27', phase: 'Fase 1: Base', type: 'RUN',          title: 'Corrida Leve',         details: { corrida: '8km @07:10 (8,4 km/h)' } },
  { date: '2026-05-27', phase: 'Fase 1: Base', type: 'STRENGTH',     title: 'Treino de Força',      details: { academia: 'Ficha A (Inferiores)' } },
  { date: '2026-05-28', phase: 'Fase 1: Base', type: 'REST',         title: 'DESCANSO ABSOLUTO',    details: { corrida: 'OFF' } },
  { date: '2026-05-28', phase: 'Fase 1: Base', type: 'BIKE',         title: 'Giro Livre',           details: { bike: '50min Giro Livre indolor' } },
  { date: '2026-05-29', phase: 'Fase 1: Base', type: 'REST',         title: 'DESCANSO ABSOLUTO',    details: { corrida: 'OFF' } },
  { date: '2026-05-30', phase: 'Fase 1: Base', type: 'RUN',          title: 'Corrida Leve',         details: { corrida: '6km @ 07:20 (8,2 km/h)' } },
  { date: '2026-05-30', phase: 'Fase 1: Base', type: 'STRENGTH',     title: 'Treino de Força',      details: { academia: 'Ficha C (Posterior + Core)' } },
  { date: '2026-05-31', phase: 'Fase 1: Base', type: 'RUN',          title: 'Longão',               details: { corrida: '15km @ 06:50 (8,8 km/h / Rua)' } },
  { date: '2026-06-01', phase: 'Fase 1: Base', type: 'REST',         title: 'DESCANSO ABSOLUTO',    details: { corrida: 'OFF' } },
  { date: '2026-06-02', phase: 'Fase 1: Base', type: 'RUN_INTERVAL', title: 'Tiros Curtos',         warmup: '2.0 km @ 6,5 km/h', cooldown: '1.5 km @ 4,5 km/h', details: { corrida: '8x400m @ 10,6 km/h', restDetails: "1'00\" Passivo" } },
  { date: '2026-06-02', phase: 'Fase 1: Base', type: 'STRENGTH',     title: 'Treino de Força',      details: { academia: 'Ficha B (Anterior + Core)' } },
  { date: '2026-06-03', phase: 'Fase 1: Base', type: 'RUN',          title: 'Corrida Leve',         details: { corrida: '8km @ 07:05 (8,5 km/h)' } },
  { date: '2026-06-03', phase: 'Fase 1: Base', type: 'STRENGTH',     title: 'Treino de Força',      details: { academia: 'Ficha A (Inferiores)' } },
  { date: '2026-06-04', phase: 'Fase 1: Base', type: 'RUN',          title: 'Corrida Regenerativa', details: { corrida: '8km @ 07:50 (7,5 km/h)' } },
  { date: '2026-06-05', phase: 'Fase 1: Base', type: 'REST',         title: 'DESCANSO ABSOLUTO',    details: { corrida: 'OFF' } },
  { date: '2026-06-06', phase: 'Fase 1: Base', type: 'RUN',          title: 'Corrida Leve',         details: { corrida: '6km @ 07:20 (8,2 km/h)' } },
  { date: '2026-06-06', phase: 'Fase 1: Base', type: 'STRENGTH',     title: 'Treino de Força',      details: { academia: 'Ficha C (Posterior + Core)' } },
  { date: '2026-06-07', phase: 'Fase 1: Base', type: 'RUN',          title: 'Longão Progressivo',   details: { corrida: '16km @ 06:50 → 06:30 (9,2 km/h)' } },
  { date: '2026-06-08', phase: 'Fase 1: Base', type: 'REST',         title: 'DESCANSO ABSOLUTO',    details: { corrida: 'OFF' } },
  { date: '2026-06-09', phase: 'Fase 1: Base', type: 'RUN_INTERVAL', title: 'Série Limiar',         warmup: '2.0 km @ 6.5 km/h', cooldown: '1.5 km @ 4.5 km/h', details: { corrida: '4x1km @ 10,1 km/h (Pace 05:55)', restDetails: "2'00\" Ativo @ 3,0 km/h" } },
  { date: '2026-06-09', phase: 'Fase 1: Base', type: 'STRENGTH',     title: 'Treino de Força',      details: { academia: 'Ficha B (Anterior + Core)' } },
  { date: '2026-06-10', phase: 'Fase 1: Base', type: 'RUN',          title: 'Corrida Leve',         details: { corrida: '8km @ 07:05 (8,5 km/h)' } },
  { date: '2026-06-10', phase: 'Fase 1: Base', type: 'STRENGTH',     title: 'Treino de Força',      details: { academia: 'Ficha A (Inferiores)' } },
  { date: '2026-06-11', phase: 'Fase 1: Base', type: 'RUN',          title: 'Corrida Regenerativa', details: { corrida: '8km @ 07:50 (7,5 km/h)' } },
  { date: '2026-06-11', phase: 'Fase 1: Base', type: 'BIKE',         title: 'Giro Livre',           details: { bike: '55min Giro Livre indolor' } },
  { date: '2026-06-12', phase: 'Fase 1: Base', type: 'REST',         title: 'DESCANSO ABSOLUTO',    details: { corrida: 'OFF' } },
  { date: '2026-06-13', phase: 'Fase 1: Base', type: 'RUN',          title: 'Corrida Leve',         details: { corrida: '5km @ 07:20 (8,2 km/h)' } },
  { date: '2026-06-13', phase: 'Fase 1: Base', type: 'STRENGTH',     title: 'Treino de Força',      details: { academia: 'Ficha C (Posterior + Core)' } },
  { date: '2026-06-14', phase: 'Fase 1: Base', type: 'RUN',          title: 'Longão Regenerativo',  details: { corrida: '12km @ 07:15 (8,3 km/h)' } },

  // ── FASE 2: DESENVOLVIMENTO ───────────────────────────────────────────────
  { date: '2026-06-15', phase: 'Fase 2: Desenv.', type: 'REST',         title: 'DESCANSO ABSOLUTO',    details: { corrida: 'OFF' } },
  { date: '2026-06-16', phase: 'Fase 2: Desenv.', type: 'RUN_INTERVAL', title: 'Volume de Tiros',      warmup: '2.0 km @ 6,5 km/h', cooldown: '1.5 km @ 4,5 km/h', details: { corrida: '6x400m @ 10,6 km/h', restDetails: "1'00\" Passivo" } },
  { date: '2026-06-16', phase: 'Fase 2: Desenv.', type: 'STRENGTH',     title: 'Treino de Força',      details: { academia: 'Ficha B (Anterior + Core)' } },
  { date: '2026-06-17', phase: 'Fase 2: Desenv.', type: 'RUN',          title: 'Corrida Leve',         details: { corrida: '8km @ 08:20 (8,3 km/h)' } },
  { date: '2026-06-17', phase: 'Fase 2: Desenv.', type: 'STRENGTH',     title: 'Treino de Força',      details: { academia: 'Ficha A (Inferiores)' } },
  { date: '2026-06-18', phase: 'Fase 2: Desenv.', type: 'RUN',          title: 'Corrida Regenerativa', details: { corrida: '8km @ 08:00 (7,5 km/h)' } },
  { date: '2026-06-18', phase: 'Fase 2: Desenv.', type: 'BIKE',         title: 'Giro Livre',           details: { bike: '60min Giro Livre indolor' } },
  { date: '2026-06-19', phase: 'Fase 2: Desenv.', type: 'REST',         title: 'DESCANSO ABSOLUTO',    details: { corrida: 'OFF' } },

  // ── FASE 2: FIM ───────────────────────────────────────────────────────────
  { date: '2026-06-20', phase: 'Fase 2: Fim', type: 'RUN',      title: 'Corrida Leve',    details: { corrida: '6km @ 07:20 (8,2 km/h)' } },
  { date: '2026-06-20', phase: 'Fase 2: Fim', type: 'STRENGTH', title: 'Treino de Força', details: { academia: 'Ficha C (Posterior + Core)' } },

  // ── FASE 3: ÁPICE ─────────────────────────────────────────────────────────
  { date: '2026-06-21', phase: 'Fase 3: Ápice', type: 'RUN',          title: 'Longão Volume Especial', details: { corrida: '18km @ 06:45 (8,9 km/h)' } },
  { date: '2026-06-22', phase: 'Fase 3: Ápice', type: 'REST',         title: 'DESCANSO ABSOLUTO',      details: { corrida: 'OFF' } },
  { date: '2026-06-23', phase: 'Fase 3: Ápice', type: 'RUN_INTERVAL', title: 'Limiar II',              warmup: '2.0 km @ 6,5 km/h', cooldown: '1.5 km @ 4,5 km/h', details: { corrida: '5x1km @ 10,3 km/h (Pace 05:50)', restDetails: "2'00\" Ativo @ 3,0 km/h" } },
  { date: '2026-06-23', phase: 'Fase 3: Ápice', type: 'STRENGTH',     title: 'Treino de Força',        details: { academia: 'Ficha B (Anterior + Core)' } },
  { date: '2026-06-24', phase: 'Fase 3: Ápice', type: 'RUN',          title: 'Corrida Leve',           details: { corrida: '8km @ 07:00 (8,6 km/h)' } },
  { date: '2026-06-24', phase: 'Fase 3: Ápice', type: 'STRENGTH',     title: 'Treino de Força',        details: { academia: 'Ficha A (Inferiores)' } },
  { date: '2026-06-25', phase: 'Fase 3: Ápice', type: 'RUN',          title: 'Corrida Regenerativa',   details: { corrida: '8km @ 07:50 (7,5 km/h)' } },
  { date: '2026-06-25', phase: 'Fase 3: Ápice', type: 'BIKE',         title: 'Giro Livre',             details: { bike: '60min Giro Livre indolor' } },
  { date: '2026-06-26', phase: 'Fase 3: Ápice', type: 'REST',         title: 'DESCANSO ABSOLUTO',      details: { corrida: 'OFF' } },
  { date: '2026-06-27', phase: 'Fase 3: Ápice', type: 'RUN',          title: 'Corrida Leve',           details: { corrida: '5km @ 07:20 (8,2 km/h)' } },
  { date: '2026-06-27', phase: 'Fase 3: Ápice', type: 'STRENGTH',     title: 'Treino de Força',        details: { academia: 'Ficha C (Posterior + Core)' } },
  { date: '2026-06-28', phase: 'Fase 3: Ápice', type: 'RUN',          title: 'Longão Ápice',           details: { corrida: '20km @ 06:45 → final 06:30' } },
  { date: '2026-06-29', phase: 'Fase 3: Ápice', type: 'REST',         title: 'DESCANSO ABSOLUTO',      details: { corrida: 'OFF' } },
  { date: '2026-06-30', phase: 'Fase 3: Ápice', type: 'RUN_INTERVAL', title: 'Tiros de Ajuste',        warmup: '2.0 km @ 6.5 km/h', cooldown: '1.5 km @ 4.5 km/h', details: { corrida: '8x400m @ 10,4 km/h', restDetails: "1'00\" Passivo (Pés lateral)" } },
  { date: '2026-06-30', phase: 'Fase 3: Ápice', type: 'STRENGTH',     title: 'Treino de Força',        details: { academia: 'Ficha B (Anterior + Core)' } },
  { date: '2026-07-01', phase: 'Fase 3: Ápice', type: 'RUN',          title: 'Corrida Leve',           details: { corrida: '8km @ 07:05 (8,5 km/h)' } },
  { date: '2026-07-01', phase: 'Fase 3: Ápice', type: 'STRENGTH',     title: 'Treino de Força',        details: { academia: 'Ficha A (Inferiores)' } },
  { date: '2026-07-02', phase: 'Fase 3: Ápice', type: 'RUN',          title: 'Corrida Regenerativa',   details: { corrida: '8km @ 07:50 (7,5 km/h)' } },
  { date: '2026-07-02', phase: 'Fase 3: Ápice', type: 'BIKE',         title: 'Giro Livre',             details: { bike: '45min Giro Livre indolor' } },
  { date: '2026-07-03', phase: 'Fase 3: Ápice', type: 'REST',         title: 'DESCANSO ABSOLUTO',      details: { corrida: 'OFF' } },
  { date: '2026-07-04', phase: 'Fase 3: Ápice', type: 'RUN',          title: 'Corrida Leve',           details: { corrida: '5km @ 07:20 (8,2 km/h)' } },
  { date: '2026-07-04', phase: 'Fase 3: Ápice', type: 'STRENGTH',     title: 'Treino de Força',        details: { academia: 'Ficha C (Posterior + Core)' } },
  { date: '2026-07-05', phase: 'Fase 3: Ápice', type: 'RUN',          title: 'Longão Taper 1',         details: { corrida: '16km @ 06:50 (8,8 km/h)' } },

  // ── FASE 4: TAPER ─────────────────────────────────────────────────────────
  { date: '2026-07-06', phase: 'Fase 4: Taper', type: 'REST',         title: 'DESCANSO ABSOLUTO',      details: { corrida: 'OFF' } },
  { date: '2026-07-07', phase: 'Fase 4: Taper', type: 'RUN_INTERVAL', title: 'Cruzeiro Final',         warmup: '2.0 km @ 6,5 km/h', cooldown: '1.5 km @ 4,5 km/h', details: { corrida: '3x2km @ 9,7 km/h (Pace 06:10)', restDetails: "2'00\" Ativo @ 3,0 km/h" } },
  { date: '2026-07-07', phase: 'Fase 4: Taper', type: 'STRENGTH',     title: 'Treino de Força',        details: { academia: 'Ficha B (Anterior + Core)' } },
  { date: '2026-07-08', phase: 'Fase 4: Taper', type: 'RUN',          title: 'Corrida Leve',           details: { corrida: '7km @ 07:15 (8,3 km/h)' } },
  { date: '2026-07-08', phase: 'Fase 4: Taper', type: 'STRENGTH',     title: 'Treino de Força',        details: { academia: 'Ficha A (Inferiores)' } },
  { date: '2026-07-09', phase: 'Fase 4: Taper', type: 'RUN',          title: 'Corrida Regenerativa',   details: { corrida: '6km @ 08:00 (7,5 km/h)' } },
  { date: '2026-07-09', phase: 'Fase 4: Taper', type: 'BIKE',         title: 'Giro Livre',             details: { bike: '40min Giro Livre indolor' } },
  { date: '2026-07-10', phase: 'Fase 4: Taper', type: 'REST',         title: 'DESCANSO ABSOLUTO',      details: { corrida: 'OFF' } },
  // ── NOVOS (FALTAVAM NO BD) ────────────────────────────────────────────────
  { date: '2026-07-11', phase: 'Fase 4: Taper', type: 'RUN',          title: 'Corrida Leve',           details: { corrida: '5km @ 07:30 (8,0 km/h)' } },
  { date: '2026-07-11', phase: 'Fase 4: Taper', type: 'STRENGTH',     title: 'Treino de Força',        details: { academia: 'Ficha C (Carga Leve)' } },
  { date: '2026-07-12', phase: 'Fase 4: Taper', type: 'RUN',          title: 'Longão Taper 2',         details: { corrida: '14km @ 06:50 (8,8 km/h)' } },
  { date: '2026-07-13', phase: 'Fase 4: Taper', type: 'REST',         title: 'DESCANSO ABSOLUTO',      details: { corrida: 'OFF' } },
  { date: '2026-07-14', phase: 'Fase 4: Taper', type: 'RUN_INTERVAL', title: 'Tiros Finais de Ajuste', warmup: '1.5 km @ 6,5 km/h', cooldown: '1.0 km @ 4,5 km/h', details: { corrida: '4x800m @ 9,7 km/h (Pace 06:10)', restDetails: "1'30\" Passivo" } },
  { date: '2026-07-14', phase: 'Fase 4: Taper', type: 'STRENGTH',     title: 'Treino de Força',        details: { academia: 'Ficha B (Só Ativação)' } },
  { date: '2026-07-15', phase: 'Fase 4: Taper', type: 'RUN',          title: 'Corrida Leve',           details: { corrida: '6km @ 07:15 (8,3 km/h)' } },
  { date: '2026-07-15', phase: 'Fase 4: Taper', type: 'STRENGTH',     title: 'Treino de Força',        details: { academia: 'Ficha A (Carga Leve)' } },
  { date: '2026-07-16', phase: 'Fase 4: Taper', type: 'RUN',          title: 'Corrida Regenerativa',   details: { corrida: '5km @ 08:00 (7,5 km/h)' } },
  { date: '2026-07-16', phase: 'Fase 4: Taper', type: 'BIKE',         title: 'Giro Regenerativo',      details: { bike: '30min Giro Regenerativo' } },
  { date: '2026-07-17', phase: 'Fase 4: Taper', type: 'REST',         title: 'DESCANSO ABSOLUTO',      details: { corrida: 'OFF' } },
  { date: '2026-07-18', phase: 'Fase 4: Taper', type: 'RUN',          title: 'Corrida Leve',           details: { corrida: '5km @ 07:20 (8,2 km/h)' } },
  { date: '2026-07-18', phase: 'Fase 4: Taper', type: 'STRENGTH',     title: 'Mobilidade + Core',      details: { academia: 'Ficha C (Mob. + Core)' } },
  { date: '2026-07-19', phase: 'Fase 4: Taper', type: 'RUN',          title: 'Longão Leve Final',      details: { corrida: '10km @ 07:00 (8,6 km/h)' } },

  // ── FASE: CLÍNICA / PROTOCOLO PRÉ-PROVA ──────────────────────────────────
  { date: '2026-07-20', phase: 'F3: Clínica',  type: 'REST',         title: 'ZONA VERMELHA – Repouso Total', details: { corrida: 'OFF' } },

  // ── FASE: NUTRIÇÃO ────────────────────────────────────────────────────────
  { date: '2026-07-21', phase: 'F5: Nutrição', type: 'RUN_INTERVAL', title: 'Protocolo Nutricional – Tiros',  warmup: '1.0 km @ 6,5 km/h', cooldown: '1.0 km @ 4,5 km/h', details: { corrida: '3x200m @ 10,6 km/h', restDetails: "1'00\" Passivo" } },
  { date: '2026-07-21', phase: 'F5: Nutrição', type: 'STRENGTH',     title: 'Mobilidade e Core Leve',         details: { academia: 'Mob. e Core Leve' } },
  { date: '2026-07-22', phase: 'F5: Nutrição', type: 'RUN',          title: 'Protocolo Nutricional – Corrida', details: { corrida: '4km @ 07:30 (8,0 km/h)' } },
  { date: '2026-07-23', phase: 'F5: Nutrição', type: 'REST',         title: 'DESCANSO PRÉ-PROVA',              details: { corrida: 'OFF' } },
  { date: '2026-07-24', phase: 'F5: Nutrição', type: 'REST',         title: 'DESCANSO PRÉ-PROVA',              details: { corrida: 'OFF' } },

  // ── FASE: TÁTICA ──────────────────────────────────────────────────────────
  { date: '2026-07-25', phase: 'F2: Tática',   type: 'RUN',          title: 'Corrida Tática Pré-Prova',       details: { corrida: '2km @ 07:30 (8,0 km/h)' } },

  // ── FASE: PROVA ───────────────────────────────────────────────────────────
  { date: '2026-07-26', phase: 'F2: Prova',    type: 'RACE',         title: 'NIKE SP CITY MARATHON',          warmup: 'Mobilidade', cooldown: 'Caminhada', details: { corrida: '21,097 km @ Meta 06:30-06:40', restDetails: 'FOCO SUB 2h20' } },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function toTimestamp(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`);
}

function inferComplianceStatus(dateStr: string): string {
  const wDate = new Date(dateStr + 'T12:00:00Z');
  const now = new Date();
  return wDate.getTime() < now.getTime() ? 'VALIDATED' : 'PENDING';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function upsertPlan() {
  const athlete = await athleteRepository.getPrimaryAthlete();
  if (!athlete) throw new Error('Atleta principal não encontrado.');

  console.log(`\n🏃 Atleta: ${athlete.name} (${athlete.id})`);

  // 1. Adiciona coluna 'phase' se ainda não existir
  console.log('\n📐 Verificando coluna "phase" na tabela...');
  await db.execute(
    sql`ALTER TABLE planned_workouts ADD COLUMN IF NOT EXISTS phase TEXT;`
  );
  console.log('   ✅ Coluna "phase" garantida.');

  // 2. Busca todos os treinos existentes do atleta
  const existing = await db
    .select({ id: plannedWorkouts.id, date: plannedWorkouts.date, type: plannedWorkouts.activityType })
    .from(plannedWorkouts)
    .where(eq(plannedWorkouts.athleteId, athlete.id));

  // Chave de existência: "YYYY-MM-DD|TYPE"
  const existingKeys = new Set(
    existing.map(w => {
      const d = new Date(w.date).toISOString().slice(0, 10);
      return `${d}|${w.type}`;
    })
  );

  console.log(`\n📊 Treinos existentes no BD: ${existing.length}`);

  // 3. Filtra apenas os que estão faltando
  const toInsert = csvWorkouts.filter(w => {
    const key = `${w.date}|${w.type}`;
    return !existingKeys.has(key);
  });

  console.log(`📥 Treinos a inserir (faltantes): ${toInsert.length}`);

  if (toInsert.length > 0) {
    const insertData = toInsert.map(w => ({
      athleteId:        athlete.id,
      date:             toTimestamp(w.date),
      activityType:     w.type,
      title:            w.title,
      warmup:           w.warmup   ?? null,
      cooldown:         w.cooldown ?? null,
      details:          w.details  ?? {},
      phase:            w.phase,
      complianceStatus: inferComplianceStatus(w.date),
      isImported:       true,
    }));

    await db.insert(plannedWorkouts).values(insertData);
    console.log(`   ✅ ${insertData.length} treinos inseridos com sucesso!`);
    toInsert.forEach(w => console.log(`      + [${w.date}] ${w.type.padEnd(12)} – ${w.title}`));
  } else {
    console.log('   ℹ️  Nenhum treino novo para inserir. BD já está atualizado.');
  }

  // 4. Atualiza 'phase' em todos os registros existentes (novos e antigos)
  console.log('\n🏷️  Atualizando campo "phase" nos treinos existentes...');
  let updated = 0;
  for (const w of csvWorkouts) {
    const wDate = toTimestamp(w.date);
    const result = await db
      .update(plannedWorkouts)
      .set({ phase: w.phase })
      .where(
        and(
          eq(plannedWorkouts.athleteId, athlete.id),
          eq(plannedWorkouts.activityType, w.type),
          // Compara só a data (ignora hora) via cast
          sql`DATE(${plannedWorkouts.date}) = DATE(${wDate.toISOString()}::timestamp)`
        )
      );
    updated++;
  }
  console.log(`   ✅ Phase atualizado em ${updated} entradas da planilha.`);

  console.log('\n🎯 Sincronização concluída!');
  setTimeout(() => process.exit(0), 500);
}

upsertPlan().catch(err => {
  console.error('\n❌ Erro durante o upsert:', err);
  setTimeout(() => process.exit(1), 500);
});
