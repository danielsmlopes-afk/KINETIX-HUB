import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { athletes } from '@/db/schema';

export const stravaRepository = {
  async saveTokens(athleteId: string, accessToken: string, refreshToken: string, expiresAt: number) {
    await db.update(athletes)
      .set({
        stravaAccessToken: accessToken,
        stravaRefreshToken: refreshToken,
        stravaExpiresAt: expiresAt,
      })
      .where(eq(athletes.id, athleteId));
  },

  async getTokens(athleteId: string) {
    const result = await db.select()
      .from(athletes)
      .where(eq(athletes.id, athleteId))
      .limit(1);
    return result[0] || null;
  }
};