// Arquivo: src/repositories/athleteRepository.ts
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { athletes } from '@/db/schema';

export const athleteRepository = {
  async getPrimaryAthlete() {
    const result = await db.select().from(athletes).limit(1);
    return result[0] || null;
  },

  async getAthlete(id: string) {
    const result = await db.select().from(athletes).where(eq(athletes.id, id)).limit(1);
    return result[0] || null;
  },
  
  async updateAthleteGoals(id: string, name: string) {
    const result = await db.update(athletes).set({ name }).where(eq(athletes.id, id)).returning();
    return result[0] || null;
  }
};