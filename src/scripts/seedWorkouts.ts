import fs from 'fs';
import path from 'path';
import '@/config/env'; // Garante que as variáveis de ambiente e banco sejam lidas
import { db } from '@/db';
import { athletes, plannedWorkouts } from '@/db/schema';

/**
 * Função tática (Helper) para limpar dados e converter strings vazias ou "null" para o null primitivo nativo do TypeScript.
 */
const sanitize = (val: string | undefined): string | null => {
  if (!val) return null;
  const trimmed = val.trim();
  if (trimmed.toLowerCase() === 'null' || trimmed === '') return null;
  return trimmed;
};

/**
 * Lógica de split cuidadosa: Parser de CSV nativo resistente a vírgulas e aspas escapadas dentro do texto rico.
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

    // 2. Operação Tábula Rasa: Limpa os treinos de forma absoluta (Sem db.transaction() por compliance com Neon HTTP)
    await db.delete(plannedWorkouts);
    console.log('🧹 Tábula Rasa concluída: Treinos antigos obliterados.');

    // 3. Leitura e Higienização do CSV usando o módulo nativo 'fs'
    const csvPath = path.resolve(__dirname, '../../Planilha_Kinetix_Colunas_Isoladas.csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Arquivo não encontrado: ${csvPath}`);
    }
    const fileContent = fs.readFileSync(csvPath, 'utf8')
      .replace(/^(?:\uFEFF|ï»¿)+/, '') // Remove BOM nativo e BOM corrompido (Double-encoded)
      .replace(/\r/g, ''); // Fix de quebra de linha do Windows
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');

    const inserts = [];
    
    // Mapeamento dinâmico de cabeçalhos
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    console.log('📊 Cabeçalhos identificados:', headers.join(', '));

    const getVal = (row: string[], colName: string) => {
      const idx = headers.indexOf(colName.toLowerCase());
      return idx !== -1 ? sanitize(row[idx]) : null;
    };

    // Pula a linha de cabeçalho (i = 1)
    for (let i = 1; i < lines.length; i++) {
      let rawLine = lines[i];
      let row = parseCSVLine(rawLine);
      
      // 🛠️ FIX TÁTICO: Tratamento de Double-Encoded CSV (Linha inteira engolida por aspas)
      // Quando a planilha exporta com vírgulas internas, ela pode encapsular a linha toda e dobrar aspas internas.
      if (row.length === 1 && rawLine.startsWith('"') && rawLine.endsWith('"')) {
        rawLine = rawLine.substring(1, rawLine.length - 1).replace(/""/g, '"');
        row = parseCSVLine(rawLine);
      }

      const dateStr = getVal(row, 'date');
      const nameStr = getVal(row, 'name');
      const warmupStr = getVal(row, 'warmup');
      const cooldownStr = getVal(row, 'cooldown');
      const restDetailsStr = getVal(row, 'restdetails');
      const corridaStr = getVal(row, 'corrida');
      const academiaStr = getVal(row, 'academia');
      const bikeStr = getVal(row, 'bike');
      
      if (!dateStr || !nameStr) {
        console.warn(`⚠️ Linha ${i + 1} ignorada por falta de data ou nome.`);
        continue;
      }

      // Compliance Estrito com workoutSchema.ts (Apenas RUN, BIKE, STRENGTH)
      let activityType = 'RUN';
      if (bikeStr && !corridaStr) activityType = 'BIKE';
      else if (academiaStr && !corridaStr && !bikeStr) activityType = 'STRENGTH';

      inserts.push({
        athleteId,
        date: new Date(dateStr),
        title: nameStr,
        activityType,
        warmup: warmupStr,
        cooldown: cooldownStr,
        details: { 
          restDetails: restDetailsStr, 
          corrida: corridaStr, 
          academia: academiaStr, 
          bike: bikeStr 
        }
      });
    }

    // 4. Inserção em Lote Limpa
    if (inserts.length > 0) {
      await db.insert(plannedWorkouts).values(inserts);
      console.log(`🚀 Operação Seed Kinetix V11: ${inserts.length} treinos injetados com sucesso.`);
    } else {
      console.log('⚠️ Nenhum treino válido encontrado no CSV para inserção.');
    }
  } catch (error) {
    console.error('❌ Erro na Operação Seed:', error);
  }
}

seedWorkouts();