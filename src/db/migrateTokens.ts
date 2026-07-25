import { env } from '@/config/env';
import { stravaRepository } from '@/repositories/stravaRepository';
import { athleteRepository } from '@/repositories/athleteRepository';

async function migrateTokens() {
  console.log('🔄 Iniciando migração dos tokens do Strava...');

  const athlete = await athleteRepository.getPrimaryAthlete();
  if (!athlete) {
    console.error('❌ Atleta principal não encontrado. Rode o seed primeiro!');
    process.exit(1);
  }

  const { STRAVA_ACCESS_TOKEN, STRAVA_REFRESH_TOKEN, STRAVA_EXPIRES_AT } = env;

  if (STRAVA_ACCESS_TOKEN && STRAVA_REFRESH_TOKEN && STRAVA_EXPIRES_AT) {
    await stravaRepository.saveTokens(athlete.id, STRAVA_ACCESS_TOKEN, STRAVA_REFRESH_TOKEN, parseInt(STRAVA_EXPIRES_AT, 10));
    console.log('✅ Tokens salvos com sucesso no banco de dados!');
  } else {
    console.log('⚠️ Tokens incompletos no arquivo .env.');
  }
}

migrateTokens().catch(console.error);
