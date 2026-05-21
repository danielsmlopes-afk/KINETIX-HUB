// Arquivo: src/repositories/telemetryRepository.ts
import { db } from '@/db/index';
import { bioimpedanceLogs } from '@/db/schema';

export const telemetryRepository = {
  async insertLog(data: { athleteId: string; weightKg: number; bodyFatPercentage: number; bmr: number }) {
    const result = await db.insert(bioimpedanceLogs).values(data).returning();
    return result[0];
  }
};