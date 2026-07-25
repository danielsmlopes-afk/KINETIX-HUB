import { db } from '@/db';
import { cronLogs, athletes } from '@/db/schema';
import { lt, isNotNull } from 'drizzle-orm';
import { env } from '@/config/env';
import { stravaRepository } from '@/repositories/stravaRepository';

export const dbMaintenanceService = {
  async runMaintenanceTasks() {
    let sessionsCleaned = 0;
    let tokensRefreshed = 0;

    try {
      // 1. Limpar logs de sistema antigos (mais de 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedLogs = await db.delete(cronLogs)
        .where(lt(cronLogs.runAt, thirtyDaysAgo))
        .returning({ id: cronLogs.id });
      
      sessionsCleaned = deletedLogs.length;

      // 2. Renovar tokens do Strava próximos do vencimento (< 1 hora)
      const athletesList = await db.select().from(athletes).where(isNotNull(athletes.stravaRefreshToken));
      
      const now = Math.floor(Date.now() / 1000);
      const EXPIRATION_THRESHOLD = 3600; // 1 hora de margem
      
      for (const athlete of athletesList) {
        if (athlete.stravaExpiresAt && athlete.stravaExpiresAt < now + EXPIRATION_THRESHOLD) {
          const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: env.STRAVA_CLIENT_ID,
              client_secret: env.STRAVA_CLIENT_SECRET,
              grant_type: 'refresh_token',
              refresh_token: athlete.stravaRefreshToken
            })
          });

          if (response.ok) {
            const data = await response.json();
            await stravaRepository.saveTokens(athlete.id, data.access_token, data.refresh_token, data.expires_at);
            tokensRefreshed++;
          }
        }
      }

      return { success: true, tokensRefreshed, sessionsCleaned };
    } catch (error) {
      console.error('❌ Erro na manutenção autônoma do banco de dados:', error);
      throw error;
    }
  }
};
