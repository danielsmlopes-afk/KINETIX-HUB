import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { plannedWorkouts, races } from '../db/schema';
import { athleteRepository } from '../repositories/athleteRepository';

/**
 * Função tática para quebrar as linhas do CSV respeitando campos com vírgulas dentro de aspas.
 */
function parseCsvLine(line: string) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuotes = !inQuotes;
    else if (line[i] === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += line[i];
    }
  }
  result.push(cur.trim());
  return result;
}

async function run() {
  console.log('🚀 Iniciando Ingestão Tática: Plano de Treinamento Nike SP...');

  const athlete = await athleteRepository.getPrimaryAthlete();
  if (!athlete) throw new Error('Atleta principal não encontrado.');

  const csvPath = path.resolve(process.cwd(), 'Plano_Matriz_Definitiva_Nike_SP.csv');
  const csvData = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvData.split(/\r?\n/).filter(l => l.trim().length > 0);

  const workoutsToInsert: any[] = [];
  const racesToInsert: any[] = [];

  for (let i = 1; i < lines.length; i++) { // Ignora o Header
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 9) continue;

    const [dataStr, dia, atividade, aq, principal, dq, repouso, musc, bike] = cols;

    // Tratamento Especial: Range de Polimento (Ex: "11/07 a 25/07")
    if (dataStr.includes(' a ')) {
      const [startStr, endStr] = dataStr.split(' a ');
      const [d1, m1] = startStr.split('/');
      const [d2, m2] = endStr.split('/');
      
      const startDate = new Date(`2026-${m1}-${d1}T09:00:00Z`);
      const endDate = new Date(`2026-${m2}-${d2}T09:00:00Z`);
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        workoutsToInsert.push({
          athleteId: athlete.id,
          date: new Date(d),
          activityType: 'RUN',
          title: atividade || 'Polimento Taper',
          details: { subtitle: principal, notes: 'Fase de Redução Progressiva' },
          isImported: true
        });
      }
      continue;
    }

    const dateParts = dataStr.split('/');
    if (dateParts.length !== 3) continue;
    // 09:00 UTC = 06:00 BRT
    const dateObj = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T09:00:00Z`);

    // Tratamento Especial: Dia da Prova
    if (atividade.toUpperCase().includes('PROVA ALVO')) {
      racesToInsert.push({
        name: 'Nike SP City Marathon',
        category: 'P1',
        date: dateObj,
        distance: 21.097, // Meia Maratona
        startTime: '06:00',
        startLocation: 'São Paulo, SP',
        isTarget: true,
        targetPace: principal.match(/Meta ([\d:]+)/)?.[1] || '06:30'
      });
      continue;
    }

    // 1. Processa Corrida (Ignora se for "OFF" ou "DESCANSO ABSOLUTO")
    if (principal !== '-' && principal !== 'OFF' && !atividade.includes('DESCANSO')) {
      workoutsToInsert.push({
        athleteId: athlete.id, date: dateObj, activityType: 'RUN',
        title: atividade.split('+')[0].trim(),
        details: { subtitle: principal, aquecimento: aq !== '-' ? aq : undefined, desaquecimento: dq !== '-' ? dq : undefined, repouso: repouso !== '-' ? repouso : undefined },
        isImported: true
      });
    }

    // 2. Processa Musculação (Treinos Simultâneos no mesmo dia)
    if (musc !== '-' && musc) {
      workoutsToInsert.push({ athleteId: athlete.id, date: dateObj, activityType: 'STRENGTH', title: `Treino de Força ${musc}`, details: { subtitle: `Ficha ${musc}` }, isImported: true });
    }

    // 3. Processa Bike (Rodagens Regenerativas)
    if (bike !== '-' && bike) {
      workoutsToInsert.push({ athleteId: athlete.id, date: dateObj, activityType: 'BIKE', title: 'Giro Regenerativo (Bike)', details: { subtitle: bike }, isImported: true });
    }
  }

  if (workoutsToInsert.length > 0) await db.insert(plannedWorkouts).values(workoutsToInsert);
  if (racesToInsert.length > 0) await db.insert(races).values(racesToInsert);
  console.log(`✅ Operação Concluída! Foram injetados ${workoutsToInsert.length} treinos no calendário e ${racesToInsert.length} prova alvo.`);
}
run().catch(console.error);