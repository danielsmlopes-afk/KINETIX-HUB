import { db } from '../db';
import { monumentRecords } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Script de Operação Tática: Normalização de Distâncias (Monumentos)
 * Comando de execução: npx tsx src/scripts/normalizeDistances.ts
 */
async function normalizeDistances() {
  console.log('🔄 [Script] Iniciando migração para a nova coluna `raceCategory` na base de Monumentos...');
  const records = await db.select().from(monumentRecords);

  let updatedCount = 0;

  for (const record of records) {
    if (!record.distance) continue;

    const distStr = record.distance.toString().toUpperCase();
    let newCategory = distStr;
    let numericDistance = distStr;
    
    if (distStr.endsWith('K')) {
      // Se já estiver com K, a categoria é o texto e a distância limpa é o número
      newCategory = distStr;
      numericDistance = distStr.replace('K', '');
    } else {
      const parsed = parseFloat(distStr);
      if (!isNaN(parsed)) {
        // Regra: Se for maior que 500, assumimos que foi gravado em metros (ex: 21000)
        const distKm = parsed > 500 ? parsed / 1000 : parsed;
        newCategory = `${Number.isInteger(distKm) ? distKm : distKm.toFixed(1)}K`;
        numericDistance = distKm.toString();
      }
    }

    await db.update(monumentRecords)
      .set({ 
        // @ts-ignore - Ignorando alerta caso o schema.ts não tenha sido salvo ainda
        raceCategory: newCategory,
        distance: numericDistance 
      })
      .where(eq(monumentRecords.id, record.id));

    console.log(`✅ Migrado [ID: ${record.id}]: ${record.eventName} | Distância Limpa: ${numericDistance} | Categoria: ${newCategory}`);
    updatedCount++;
  }

  console.log(`🚀 [Script] Operação concluída! ${updatedCount} registros normalizados.`);
  process.exit(0);
}

normalizeDistances().catch(error => {
  console.error('⚠️ Falha fatal durante a normalização:', error);
  process.exit(1);
});
