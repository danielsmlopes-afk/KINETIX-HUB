import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { shoes, workoutSessions, consumables, plannedWorkouts } from '@/db/schema';
import { calculatePNL } from '@/services/loadCalculator';
import { StravaActivity } from '@/services/stravaService';
import { calculateAndDeductGels } from '@/services/nutritionCalculator';
import { getHistoricalWeather, getTodayWeather } from '@/services/weatherService';

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
    
    // Busca a temperatura histórica exata baseada nas coordenadas e horário da largada
    let weather = null;
    if (activity.start_latlng && activity.start_latlng.length === 2) {
      weather = await getHistoricalWeather(activity.start_latlng[0], activity.start_latlng[1], activity.start_date);
    }

    await db.insert(workoutSessions).values({ 
      athleteId, 
      date: new Date(activity.start_date), 
      durationMinutes,
      load: pnl,
      distance: activity.distance,
      gearId: activity.gear_id,
      averageHeartRate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
      mapPolyline: activity.map?.summary_polyline || null,
      weather
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
  },

  async validateManualWorkout(
    workoutId: string, 
    modality: string, 
    mapPolyline?: string, 
    distance?: number, 
    weatherStr?: string,
    durationMinutes?: number,
    averageHeartRate?: number,
    complianceFeedback?: string
  ) {
    // Marca o registro do plano diretamente como VALIDATED e salva o feedback de execução
    await db.update(plannedWorkouts)
      .set({ 
        complianceStatus: 'VALIDATED',
        complianceFeedback: complianceFeedback || null
      })
      .where(eq(plannedWorkouts.id, workoutId));

    // Se houver dados de telemetria indoor/virtual vindos da validação do App
    const planList = await db.select().from(plannedWorkouts).where(eq(plannedWorkouts.id, workoutId)).limit(1);
    if (planList.length > 0) {
      const plan = planList[0];
      
      let loadValue: number | null = null;
      if (modality === 'RUN' && durationMinutes) {
        // Estimativa simples de elevação acumulada como 0 para treino manual
        loadValue = calculatePNL(durationMinutes, 0);
      }

      await db.insert(workoutSessions).values({
        athleteId: plan.athleteId,
        date: plan.date,
        durationMinutes: durationMinutes || 60, // Fallback genérico para registro manual
        distance: distance ? Number(distance) : null,
        averageHeartRate: averageHeartRate ? Number(averageHeartRate) : null,
        mapPolyline: mapPolyline || null,
        weather: weatherStr || null,
        load: loadValue
      });
      console.log(`🗺️ [Soberania Cartográfica] Sessão Indoor/Virtual injetada na telemetria. Distância: ${distance || 0}m`);
    }

    console.log(`✅ [Manual Validation] Treino ${workoutId} (Modalidade: ${modality}) chancelado manualmente.`);
  }
};