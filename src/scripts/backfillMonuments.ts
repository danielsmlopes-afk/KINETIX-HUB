import { db } from '../db';
import { monumentRecords, races } from '../db/schema';
import { eq } from 'drizzle-orm';

async function backfill() {
  console.log('🏆 Iniciando Backfill de Monumentos (Monumentos existentes <- Races)...');

  try {
    // 1. Ler todos os monumentos existentes
    const existingMonuments = await db.select().from(monumentRecords);
    console.log(`🔍 Encontrados ${existingMonuments.length} monumentos cadastrados.`);

    // 2. Ler todas as provas (races)
    const allRaces = await db.select().from(races);
    console.log(`🔍 Encontradas ${allRaces.length} provas no banco.`);

    let updatedCount = 0;

    for (const monument of existingMonuments) {
      // Relaciona pelo nome da prova (event_name / name) e ano (year / date.getFullYear())
      const matchingRace = allRaces.find(race => {
        if (!race.name || !race.date) return false;
        const raceYear = race.date.getFullYear();
        
        const monumentName = (monument.eventName || '').trim().toLowerCase();
        const raceName = (race.name || '').trim().toLowerCase();
        
        return monumentName === raceName && monument.year === raceYear;
      });

      if (matchingRace) {
        console.log(`⚡ Correspondência encontrada para: "${monument.eventName}" (${monument.year})`);

        // Extrai a temperatura numérica a partir do texto do clima da prova (ex: "22 °C")
        let temperature: number | null = monument.temperature;
        if (matchingRace.weather) {
          const match = matchingRace.weather.match(/(-?\d+)\s*°C/i);
          if (match) {
            temperature = parseInt(match[1], 10);
          }
        }

        // Atualizar o registro com dados da prova correspondente
        await db.update(monumentRecords)
          .set({
            date: matchingRace.date,
            locationCity: matchingRace.startLocation || monument.locationCity,
            weather: matchingRace.weather || monument.weather,
            temperature: temperature,
            polyline: matchingRace.polyline || monument.polyline,
            mapImageUrl: matchingRace.mapImageUrl || monument.mapImageUrl
          })
          .where(eq(monumentRecords.id, monument.id));

        console.log(`   ✅ Atualizado: date=${matchingRace.date?.toISOString()}, city=${matchingRace.startLocation}, weather=${matchingRace.weather}, temp=${temperature}, polyline=${matchingRace.polyline ? 'SIM' : 'NÃO'}, mapUrl=${matchingRace.mapImageUrl}`);
        updatedCount++;
      } else {
        console.log(`⚠️ Nenhum correspondente em 'races' para: "${monument.eventName}" (${monument.year})`);
      }
    }

    console.log(`\n🎉 Backfill Concluído! ${updatedCount} monumentos atualizados.`);
    setTimeout(() => process.exit(0), 500);
  } catch (error) {
    console.error('💥 Erro fatal durante a execução do backfill:', error);
    setTimeout(() => process.exit(1), 500);
  }
}

backfill();
