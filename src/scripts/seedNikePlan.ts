import fs from 'fs';
import path from 'path';
import { db } from '@/db';
import { plannedWorkouts, athletes } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Helper para extrair CSV de forma segura (ignora aspas duplas)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
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

async function seedNikePlan() {
  console.log('🔄 Iniciando limpeza e ingestão tática da Planilha Kinetix...');

  try {
    // Busca a identidade do comandante
    const athleteList = await db.select().from(athletes).limit(1);
    if (athleteList.length === 0) {
      console.error('❌ Nenhum atleta encontrado no banco de dados. Cadastre um atleta primeiro.');
      process.exit(1);
    }
    const athleteId = athleteList[0].id;

    // 1. Limpar a matriz de treinos atual
    console.log(`🗑️ Removendo treinos planejados antigos para o atleta ${athleteList[0].name}...`);
    await db.delete(plannedWorkouts).where(eq(plannedWorkouts.athleteId, athleteId));
    console.log('✅ Base de treinos desocupada com sucesso.');

    // 2. Localizar o CSV
    const csvPath = 'C:\\KINETIX\\kinetix-api\\Planilha_Kinetix_Nome_Puro.csv';
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ Arquivo não encontrado no QG: ${csvPath}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(csvPath, 'utf8')
      .replace(/^(?:\uFEFF|ï»¿)+/, '') // Remove BOM (caracteres invisíveis)
      .replace(/\r/g, ''); // Corrige quebras de linha do Windows

    const lines = fileContent.split('\n').filter(l => l.trim().length > 0);

    // Extração dinâmica do cabeçalho
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    
    const getVal = (row: string[], colName: string) => {
      const idx = headers.indexOf(colName.toLowerCase());
      if (idx !== -1 && row[idx]) {
        const val = row[idx].trim();
        if (val.toLowerCase() === 'null' || val === '' || val.toUpperCase() === 'OFF') return null;
        return val;
      }
      return null;
    };

    let insertedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      let rawLine = lines[i];
      let row = parseCSVLine(rawLine);

      // Fix para linhas encapsuladas inteiras por aspas (Double-Encoded)
      if (row.length === 1 && rawLine.startsWith('"') && rawLine.endsWith('"')) {
        rawLine = rawLine.substring(1, rawLine.length - 1).replace(/""/g, '"');
        row = parseCSVLine(rawLine);
      }

      const dateStr = getVal(row, 'date');
      const name = getVal(row, 'name');
      
      if (!dateStr || !name) continue;

      const warmup = getVal(row, 'warmup');
      const cooldown = getVal(row, 'cooldown');
      const restDetails = getVal(row, 'restdetails');
      const corrida = getVal(row, 'corrida');
      const academia = getVal(row, 'academia') || getVal(row, 'musculacao');
      const bike = getVal(row, 'bike');

      // Se for dia de "DESCANSO" total e não houver métricas cruzadas, pula.
      if (name.toUpperCase().includes('DESCANSO') && !corrida && !academia && !bike) continue;

      // Fixa a data no meio do dia para evitar problemas de deslocamento de fuso (Timezone Shift)
      const date = new Date(`${dateStr}T12:00:00Z`);

      if (corrida) {
        await db.insert(plannedWorkouts).values({ athleteId, date, activityType: 'RUN', title: name, warmup, cooldown, details: { corrida, restDetails }, isImported: true });
        insertedCount++;
      }

      if (academia) {
        await db.insert(plannedWorkouts).values({ athleteId, date, activityType: 'STRENGTH', title: 'Laboratório de Força', details: { academia }, isImported: true });
        insertedCount++;
      }

      if (bike) {
        await db.insert(plannedWorkouts).values({ athleteId, date, activityType: 'BIKE', title: 'Ciclismo / Giro Livre', details: { bike }, isImported: true });
        insertedCount++;
      }
    }

    console.log(`✅ Operação Finalizada! ${insertedCount} blocos de atividades foram semeados com Metadados Isolados.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Falha Crítica na ingestão do CSV:', error);
    process.exit(1);
  }
}

seedNikePlan();