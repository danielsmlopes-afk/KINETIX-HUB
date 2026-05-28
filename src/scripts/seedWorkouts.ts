import fs from 'fs';
import path from 'path';
import '@/config/env'; // Garante que as variáveis de ambiente e banco sejam lidas
import { db } from '@/db';
import { athletes, plannedWorkouts } from '@/db/schema';

/**
 * Função tática para limpar dados e converter strings vazias ou "null" para o null primitivo nativo.
 */
const sanitize = (val: string): string | null => {
  if (!val) return null;
  const trimmed = val.trim();
  if (trimmed.toLowerCase() === 'null') return null;
  return trimmed;
};

/**
 * Parser de CSV nativo resistente a vírgulas e aspas escapadas dentro do texto rico.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i++; // Pula a aspa dupla de escape
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

async function seedWorkouts() {
  try {
    // 1. Busca do Comandante
    const athleteList = await db.select().from(athletes).limit(1);
    if (athleteList.length === 0) {
      throw new Error('Nenhum atleta encontrado no banco. Execute o db:seed original primeiro.');
    }
    const athleteId = athleteList[0].id;

    // 2. Operação Tábula Rasa (Sem db.transaction() por compliance com Neon HTTP)
    await db.delete(plannedWorkouts);
    console.log('🧹 Tábula Rasa concluída: Treinos antigos obliterados.');

    // 3. Leitura e Higienização do CSV
    const csvPath = path.resolve(__dirname, '../../Planilha_Completa_Kinetix_Hub.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '').replace(/\r/g, ''); // Remove BOM e fix de quebra do Windows
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');

    const inserts = [];
    // Pula a linha de cabeçalho (i = 1)
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      
      // Colunas do CSV: [0]date, [1]day, [2]name, [3]warmup, [4]cooldown, [5]restDetails, [6]description
      const warmupStr = sanitize(row[3]);
      
      inserts.push({
        athleteId,
        date: new Date(sanitize(row[0])!),
        title: sanitize(row[2])!,
        activityType: warmupStr ? 'RUN_INTERVAL' : 'RUN_STEADY',
        warmup: warmupStr,
        cooldown: sanitize(row[4]),
        details: { restDetails: sanitize(row[5]), description: sanitize(row[6]) }
      });
    }

    // 4. Inserção em Lote Limpa
    await db.insert(plannedWorkouts).values(inserts);
    console.log(`🚀 Operação Seed Kinetix V11: ${inserts.length} treinos injetados com sucesso.`);
  } catch (error) {
    console.error('❌ Erro na Operação Seed:', error);
  }
}

seedWorkouts();