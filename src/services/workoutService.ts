import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { shoes, workoutSessions, consumables } from '@/db/schema';
import { calculatePNL } from '@/services/loadCalculator';
import { StravaActivity } from '@/services/stravaService';
import { calculateAndDeductGels } from '@/services/nutritionCalculator';

export const workoutService = {
  async processStravaActivity(athleteId: string, activity: StravaActivity) {
    // 1. Atualizar a quilometragem do Tênis
    if (activity.gear_id) {
      const shoeList = await db.select().from(shoes).where(eq(shoes.stravaGearId, activity.gear_id)).limit(1);
      if (shoeList.length > 0) {
        const shoe = shoeList[0];
        const distanceKm = activity.distance / 1000;
        const newMileage = shoe.mileage + distanceKm;
        await db.update(shoes).set({ mileage: newMileage }).where(eq(shoes.id, shoe.id));
        console.log(`👟 Equipamento [${shoe.name}] atualizado: +${distanceKm.toFixed(2)}km (Total: ${newMileage.toFixed(2)}km)`);
      }
    }

    // 2. Calcular a Carga Normalizada (PNL) e Salvar o Treino
    const durationMinutes = Math.floor(activity.moving_time / 60);
    const pnl = calculatePNL(durationMinutes, activity.total_elevation_gain || 0);
    
    await db.insert(workoutSessions).values({ 
      athleteId, 
      date: new Date(activity.start_date), 
      durationMinutes,
      load: pnl,
      distance: activity.distance,
      gearId: activity.gear_id
    });
    console.log(`📊 Treino salvo! Duração: ${durationMinutes}min | Carga Normalizada (PNL calculada): ${pnl.toFixed(2)}`);

    // 3. Logística: Dedução automática de Géis
    const gelList = await db.select().from(consumables).where(eq(consumables.type, 'gel')).limit(1);
    if (gelList.length > 0) {
      const gelsUsed = await calculateAndDeductGels(durationMinutes, gelList[0].id);
      if (gelsUsed > 0) {
        console.log(`📦 Logística Kinetix: ${gelsUsed}x [${gelList[0].name}] debitados do inventário (Treino longo detectado).`);
      }
    }
  }
};