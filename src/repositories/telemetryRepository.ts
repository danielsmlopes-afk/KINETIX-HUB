// Arquivo: src/repositories/telemetryRepository.ts
import { db } from '@/db/index';
import { bioimpedanceLogs } from '@/db/schema';

export interface BioimpedancePayload {
  date: string;
  weight: number;
  body_fat: number;
  muscle_mass: number;
  body_water: number;
  visceral_fat: number;
  metabolic_age: number;
  tmb: number;
  protein: number;
  bone_mass: number;
  health_notes?: string;
}

export const telemetryRepository = {
  async insertLog(athleteId: string, payload: BioimpedancePayload) {
    const result = await db.insert(bioimpedanceLogs).values({
      athleteId,
      date: new Date(payload.date),
      weight: payload.weight,
      bodyFat: payload.body_fat,
      muscleMass: payload.muscle_mass,
      bodyWater: payload.body_water,
      visceralFat: payload.visceral_fat,
      metabolicAge: payload.metabolic_age,
      tmb: payload.tmb,
      protein: payload.protein,
      boneMass: payload.bone_mass,
      healthNotes: payload.health_notes || "",
    }).returning();
    return result[0];
  }
};