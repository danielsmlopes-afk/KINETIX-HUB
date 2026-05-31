import { db } from '@/db';
import { workoutSessions } from '@/db/schema';
import { athleteRepository } from '@/repositories/athleteRepository';
import { StravaService } from '@/services/stravaService';
import { isNull, eq } from 'drizzle-orm';

const stravaService = new StravaService();

async function migrateData() {
  console.log('🗺️ Iniciando migração retroativa de Polylines (Strava)...');
  
  const athlete = await athleteRepository.getPrimaryAthlete();
  if (!athlete) {
    console.error('❌ Atleta não encontrado na base de dados.');
    process.exit(1);
  }

  // 1. Localizar apenas sessões de treino que não possuem Polyline
  const sessionsWithoutPolyline = await db.select()
    .from(workoutSessions)
    .where(isNull(workoutSessions.mapPolyline));

  if (sessionsWithoutPolyline.length === 0) {
    console.log('✅ Todas as sessões já possuem mapPolyline. Nenhuma migração necessária.');
    process.exit(0);
  }

  console.log(`🔍 Encontradas ${sessionsWithoutPolyline.length} sessões sem polyline. Varrendo o Strava...`);

  let page = 1;
  let updatedCount = 0;

  // 2. Paginação na API do Strava buscando histórico
  while (true) {
    console.log(`Buscando página ${page} de atividades no Strava...`);
    const activities = await stravaService.getAthleteActivities(athlete.id, page, 200);
    
    if (activities.length === 0) break; // Fim do histórico

    for (const activity of activities) {
      if (!activity.map?.summary_polyline) continue; // Pula se o Strava não tiver mapa (ex: esteira)

      const activityDate = new Date(activity.start_date);
      
      // Busca a sessão correspondente usando tolerância de 1 minuto no timestamp
      const matchingSession = sessionsWithoutPolyline.find(s => Math.abs(s.date.getTime() - activityDate.getTime()) < 60000);

      if (matchingSession) {
        await db.update(workoutSessions)
          .set({ mapPolyline: activity.map.summary_polyline })
          .where(eq(workoutSessions.id, matchingSession.id));
          
        updatedCount++;
        console.log(`✅ Polyline injetada na sessão ${matchingSession.id} (Data: ${activityDate.toLocaleDateString('pt-BR')})`);
      }
    }
    page++;
  }

  console.log(`\n🎉 Migração de Soberania Cartográfica concluída! ${updatedCount} sessões atualizadas com sucesso.`);
  process.exit(0);
}

migrateData().catch(console.error);