import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db';
import { bioimpedanceLogs, athletes } from '../db/schema';

// Tipagem de inserção inferida rigorosamente do schema (Zero 'any')
type BioimpedanceInsert = typeof bioimpedanceLogs.$inferInsert;

async function seedBioimpedance() {
  try {
    console.log('⏳ Iniciando extração e parser do CSV OKOK...');
    
    // 1. Recupera o atleta primário para vincular o histórico clínico
    const athleteList = await db.select().from(athletes).limit(1);
    if (athleteList.length === 0) {
      throw new Error('Comandante ausente. Nenhum atleta registado no banco de dados.');
    }
    const athleteId = athleteList[0].id;

    // 2. Localiza o ficheiro de exportação (por omissão na raiz da API)
    const filePath = path.resolve(process.cwd(), 'okok-2026-05-25-21-02-11-weight.csv');
    if (!fs.existsSync(filePath)) {
       throw new Error(`Ficheiro de telemetria não encontrado: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');

    // REGRA DE LIMPEZA: Ignorar as 3 primeiras linhas de metadados
    // A 4ª linha geralmente é o cabeçalho. Os dados começam no índice 4 (5ª linha).
    const dataLines = lines.slice(4);
    const records: BioimpedanceInsert[] = [];

    // Inferência de ano baseada na nomenclatura do ficheiro (ex: okok-2026...)
    const filenameYearMatch = filePath.match(/okok-(\d{4})/);
    const baseYear = filenameYearMatch ? filenameYearMatch[1] : new Date().getFullYear().toString();

    // 3. Processamento Cirúrgico do Histórico
    for (const line of dataLines) {
      const cols = line.split(',').map(col => col.trim());
      
      // Validação: Exige no mínimo 5 colunas (Data, Hora, Peso, Gordura, Músculo)
      if (cols.length < 5) continue;
      
      const rawDate = cols[0]; // ex: "03-30" ou "2026-03-30"
      const rawTime = cols[1]; // ex: "10:58"
      
      let year = baseYear;
      let monthDay = rawDate;
      
      // Garante suporte se o OKOK atualizar e passar a exportar a data completa
      if (rawDate.split('-').length === 3) {
        const parts = rawDate.split('-');
        year = parts[0];
        monthDay = `${parts[1]}-${parts[2]}`;
      }
      
      const recordDate = new Date(`${year}-${monthDay}T${rawTime}:00Z`);
      if (isNaN(recordDate.getTime())) continue; // Pula blocos corrompidos

      records.push({
        athleteId,
        date: recordDate,
        weight: parseFloat(cols[2]) || 0,
        bodyFat: parseFloat(cols[3]) || 0,
        muscleMass: parseFloat(cols[4]) || 0,
        bodyWater: parseFloat(cols[5]) || 0, 
        visceralFat: parseFloat(cols[6]) || 0,
        metabolicAge: parseInt(cols[7], 10) || 0,
        tmb: parseFloat(cols[8]) || 0,
        protein: parseFloat(cols[9]) || 0,
        boneMass: parseFloat(cols[10]) || 0,
        healthNotes: 'Importação nativa via OKOK CSV',
      });
    }

    // 4. Injeção na Base de Dados com Drizzle
    if (records.length > 0) {
      await db.insert(bioimpedanceLogs).values(records);
      console.log(`✅ Histórico de Bioimpedância importado com sucesso: ${records.length} registos.`);
    } else {
      console.log('⚠️ Nenhum registo clínico válido extraído do ficheiro CSV.');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Falha crítica ao importar Bioimpedância: ${errorMsg}`);
  } finally {
    process.exit(0); // Garante libertação da thread após conclusão
  }
}

seedBioimpedance();