import { athleteRepository } from '@/repositories/athleteRepository';
import { StravaService } from '@/services/stravaService';
import { db } from '@/db';
import { races } from '@/db/schema';
import { getCityFromCoordinates, getHistoricalWeather } from '@/services/weatherService';

const stravaService = new StravaService();

async function importRaces() {
  console.log('🔄 Varrer histórico do Strava em busca de Provas...');
  const athlete = await athleteRepository.getPrimaryAthlete();
  if (!athlete) {
    console.error('❌ Atleta não encontrado.');
    process.exit(1);
  }

  let page = 1;
  const pastRaces = [];

  // Busca todo o histórico (com páginas de 200 atividades para otimizar requisições)
  while (true) {
    console.log(`Buscando página ${page}...`);
    const activities = await stravaService.getAthleteActivities(athlete.id, page, 200);
    
    if (activities.length === 0) break;

    // workout_type === 1 significa "Prova" no Strava
    const races = activities.filter(a => a.type === 'Run' && a.workout_type === 1);
    pastRaces.push(...races);
    
    page++;
  }

  // Busca as provas já existentes no banco para evitar duplicatas
  const existingRacesInDb = await db.select().from(races);
  const existingSignatures = new Set(existingRacesInDb.map(r => `${r.name}-${r.date.toISOString()}`));

  console.log(`\n🏆 Encontramos ${pastRaces.length} provas no seu histórico mapeado:`);
  for (const race of pastRaces) {
    const raceDate = new Date(race.start_date);
    const signature = `${race.name}-${raceDate.toISOString()}`;

    if (existingSignatures.has(signature)) {
      console.log(`- ⏭️ Ignorando: ${race.name} (já salva no banco)`);
      continue;
    }
    
    // Adiciona à lista para evitar duplicatas dentro da mesma varredura
    existingSignatures.add(signature);

    const distanceKm = (race.distance / 1000).toFixed(2);
    const date = raceDate.toLocaleDateString('pt-BR');
    
    let startLocation = 'Importado do Strava';
    let weather = null;
    if (race.start_latlng && race.start_latlng.length === 2) {
      startLocation = await getCityFromCoordinates(race.start_latlng[0], race.start_latlng[1]);
      weather = await getHistoricalWeather(race.start_latlng[0], race.start_latlng[1], race.start_date);
    }

    console.log(`- ${date}: ${race.name} (${distanceKm} km) | Local: ${startLocation} | Clima: ${weather || 'N/A'}`);
    
    // Salva a prova histórica no banco
    await db.insert(races).values({
      category: 'Histórico',
      priority: 'P3', // Provas passadas entram com prioridade menor no backlog
      name: race.name,
      date: raceDate,
      distance: race.distance / 1000,
      startTime: raceDate.toISOString().substring(11, 16),
      startLocation: startLocation,
      address: startLocation, // Usa a cidade como endereço genérico
      latitude: race.start_latlng && race.start_latlng.length === 2 ? race.start_latlng[0] : null,
      longitude: race.start_latlng && race.start_latlng.length === 2 ? race.start_latlng[1] : null,
      polyline: race.map?.summary_polyline || null,
      movingTime: race.moving_time,
      weather: weather
    });
  }

  console.log('\n✅ Provas históricas importadas e salvas com sucesso no banco de dados!');
}

importRaces().catch(console.error);
