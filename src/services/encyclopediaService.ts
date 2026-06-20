import { db } from '../db';
import { monumentRecords, systemConfigs, athletes } from '../db/schema';
import { eq } from 'drizzle-orm';

export class EncyclopediaService {
  /**
   * Sistema de Gatilho (Event-Driven)
   * Atualiza a flag de cache sinalizando dados novos na Enciclopédia.
   */
  static async triggerCacheUpdate() {
    const timestamp = Date.now().toString();
    await db.insert(systemConfigs)
      .values({ key: 'encyclopedia_last_update', value: timestamp })
      .onConflictDoUpdate({
        target: systemConfigs.key,
        set: { value: timestamp, updatedAt: new Date() }
      });
  }

  /**
   * Processa o Webhook ou Sincronização Massiva
   */
  static async processStravaActivities(activities: any[]) {
    let hasNewEntries = false;

    const athletesList = await db.select().from(athletes).limit(1);
    if (!athletesList.length) return;
    const athleteId = athletesList[0].id;

    for (const act of activities) {
      const isRun = act.type === 'Run';
      const isRide = act.type === 'Ride';
      
      if (!isRun && !isRide) continue;

      let isEpicRide = false;
      if (isRide) {
        const distance = act.distance || 0; // em metros
        const city = (act.location_city || '').toLowerCase();
        if (distance > 70000 || (city && city !== 'são paulo')) {
          isEpicRide = true;
        }
      }

      // Classificação (Se for corrida de prova/monumento ou um Epic Ride)
      const isMonument = isRun && (act.workout_type === 1 || act.distance >= 21000); 

      if (isMonument || isEpicRide) {
        const dateObj = act.start_date ? new Date(act.start_date) : new Date();
        const year = dateObj.getFullYear();
        const movingTime = act.moving_time || act.elapsed_time || 0;
        const distKm = (act.distance || 0) / 1000;
        const paceDec = distKm > 0 ? (movingTime / 60) / distKm : 0;
        const paceM = Math.floor(paceDec);
        const paceS = Math.floor((paceDec - paceM) * 60);
        const pace = `${paceM.toString().padStart(2, '0')}:${paceS.toString().padStart(2, '0')}`;

        const officialTimeH = Math.floor(movingTime / 3600);
        const officialTimeM = Math.floor((movingTime % 3600) / 60);
        const officialTimeS = movingTime % 60;
        const officialTime = officialTimeH > 0 
          ? `${officialTimeH}:${officialTimeM.toString().padStart(2, '0')}:${officialTimeS.toString().padStart(2, '0')}`
          : `${officialTimeM.toString().padStart(2, '0')}:${officialTimeS.toString().padStart(2, '0')}`;
          
        let raceCategory = null;
        if (isMonument && !isEpicRide) {
          if (act.distance >= 9800 && act.distance <= 10500) raceCategory = '10K';
          else if (act.distance >= 20900 && act.distance <= 21500) raceCategory = '21K';
          else if (act.distance >= 41800 && act.distance <= 42500) raceCategory = '42K';
          else raceCategory = `${Number.isInteger(distKm) ? distKm : distKm.toFixed(1)}K`;
        }

        await db.insert(monumentRecords).values({
          athleteId: athleteId,
          year,
          eventName: act.name || 'Strava Activity',
          activityType: act.type,
          distance: distKm.toString(),
          raceCategory: raceCategory,
          officialTime,
          pace,
          polyline: act.map?.summary_polyline || null,
          mapImageUrl: null,
          locationCity: act.location_city || 'Desconhecida',
          temperature: act.average_temp || 0,
          date: dateObj,
        }).onConflictDoNothing();

        hasNewEntries = true;
      }
    }

    // Se salvamos pelo menos um Epic Ride ou Prova, invalidamos o cache do frontend
    if (hasNewEntries) {
      await this.triggerCacheUpdate();
    }
  }

  /**
   * Retorna a versão atual (timestamp) do cache
   */
  static async getEncyclopediaVersion() {
    const configList = await db.select().from(systemConfigs).where(eq(systemConfigs.key, 'encyclopedia_last_update')).limit(1);
    return configList.length > 0 ? parseInt(configList[0].value) : 0;
  }

  /**
   * Extração Sincronizada para o Endpoint
   */
  static async getEncyclopediaData() {
    // Busca o timestamp do último gatilho
    let lastUpdate = await this.getEncyclopediaVersion();
    if (lastUpdate === 0) lastUpdate = Date.now();

    const records = await db.select().from(monumentRecords);
    const data: Record<string, any> = {};

    // Agrupamento histórico (Anos 2016-2026)
    for (const record of records) {
      const year = record.date ? new Date(record.date).getFullYear().toString() : new Date().getFullYear().toString();
      
      if (!data[year]) {
        data[year] = {
          volumeCorridas: 0,
          tempoRuas: 0,
          provas: [],
          epicRides: []
        };
      }

      if (record.activityType === 'Run') {
        let distKm = 0;
        const distStr = record.distance?.toString().toUpperCase() || '0';
        if (distStr.endsWith('K')) {
          distKm = parseFloat(distStr.replace('K', '')) || 0;
        } else {
          const parsed = parseFloat(distStr) || 0;
          distKm = parsed > 500 ? parsed / 1000 : parsed;
        }
        data[year].volumeCorridas += distKm;
        
        const timeParts = (record.officialTime || '0').split(':').map(Number);
        let minutes = 0;
        if (timeParts.length === 3) {
          minutes = timeParts[0] * 60 + timeParts[1] + (timeParts[2] || 0) / 60;
        } else if (timeParts.length === 2) {
          minutes = timeParts[0] + (timeParts[1] || 0) / 60;
        } else {
          minutes = parseFloat(record.officialTime || '0') / 60;
        }
        
        data[year].tempoRuas += minutes;
        data[year].provas.push(record);
      } else if (record.activityType === 'Ride') {
        data[year].epicRides.push(record);
      }
    }

    return { lastUpdate, data };
  }
}