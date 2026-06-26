import { Context } from 'hono';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { EncyclopediaService } from '../services/encyclopediaService';
import { athleteRepository } from '../repositories/athleteRepository';

export const EncyclopediaController = {
  async getEncyclopedia(c: Context) {
    try {
      const user = c.get('user');
      const athleteId = user?.id ?? user?.uid ?? c.get('athleteId') ?? c.req.header('athleteId') ?? (await athleteRepository.getPrimaryAthlete())?.id;

      // 1. Volume anual total de TODAS as atividades do ano
      // Conversão de metros para KM e segundos para Horas (1 casa decimal)
      const volumeQuery = await db.execute(sql`
        SELECT 
          EXTRACT(YEAR FROM date)::int AS "year",
          ROUND((SUM(distance) / 1000.0)::numeric, 1) AS "volumeCorridas",
          ROUND((SUM(duration_minutes) / 60.0)::numeric, 1) AS "tempoRuas"
        FROM workout_sessions
        WHERE athlete_id = ${athleteId}
        GROUP BY EXTRACT(YEAR FROM date)
      `);

      // 2. Extração das provas com propriedades exatas solicitadas
      const provasQuery = await db.execute(sql`
        SELECT 
          id,
          event_name AS "eventName",
          TO_CHAR(date, 'YYYY-MM-DD') AS "date",
          distance,
          official_time AS "officialTime",
          pace,
          location_city,
          temperature,
          weather,
          polyline,
          map_image_url,
          is_year_pr AS "isYearPr",
          is_all_time_pr AS "isAllTimePr",
          activity_type AS "activityType"
        FROM monument_records
        WHERE athlete_id = ${athleteId}
        ORDER BY date DESC
      `);

      const encyclopediaData: Record<number, any> = {};

      // Injeta os Volumes Anuais Agrupados
      for (const row of volumeQuery.rows) {
        const year = row.year as number;
        encyclopediaData[year] = {
          volumeCorridas: row.volumeCorridas !== null ? Number(row.volumeCorridas) : null,
          tempoRuas: row.tempoRuas !== null ? Number(row.tempoRuas) : null,
          provas: [],
          epicRides: [] // Preservado para retrocompatibilidade no app Mobile
        };
      }

      // Mapeamento Estrito e Proteção contra Nulos para o App
      for (const row of provasQuery.rows) {
        const year = row.date ? parseInt((row.date as string).substring(0, 4), 10) : new Date().getFullYear();
        
        if (!encyclopediaData[year]) {
          encyclopediaData[year] = { volumeCorridas: null, tempoRuas: null, provas: [], epicRides: [] };
        }

        let mapUrl = row.map_image_url ?? null;
        if (!mapUrl && row.polyline) {
          mapUrl = `/api/hall-of-fame/${row.id}/map`;
        }

        encyclopediaData[year].provas.push({
          id: row.id ?? null,
          eventName: row.eventName ?? null,
          date: row.date ?? null,
          distance: row.distance !== null ? Number(row.distance) : null,
          officialTime: row.officialTime ?? null,
          pace: row.pace ?? null,
          location_city: row.location_city ?? null,
          temperature: row.temperature !== null ? Number(row.temperature) : null,
          weather: row.weather ?? null,
          map_image_url: mapUrl,
          isYearPr: row.isYearPr ?? null,
          isAllTimePr: row.isAllTimePr ?? null,
          activityType: row.activityType ?? 'Run',
        });
      }

      return c.json({
        success: true,
        lastUpdate: Date.now().toString(),
        data: encyclopediaData
      });

    } catch (error) {
      console.error('💥 Erro no Endpoint da Enciclopédia:', error);
      return c.json({ success: false, error: 'Internal Server Error' }, 500);
    }
  },

  async getVersion(c: Context) {
    try {
      const lastUpdate = await EncyclopediaService.getEncyclopediaVersion();
      return c.json({
        success: true,
        lastUpdate: lastUpdate.toString()
      });
    } catch (error) {
      console.error('💥 Erro ao buscar versão da Enciclopédia:', error);
      return c.json({ success: false, error: 'Internal Server Error' }, 500);
    }
  }
};