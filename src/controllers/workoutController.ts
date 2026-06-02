import { Context } from 'hono';
import { workoutService } from '@/services/workoutService';
import { athleteRepository } from '@/repositories/athleteRepository';
import { getTodayWeather, getCityFromCoordinates } from '@/services/weatherService';

export const workoutController = {
  async validateManual(c: Context) {
    try {
      const body = await c.req.json();
      const { workoutId, modality, mapPolyline, distance } = body;
      let location = body.location ? String(body.location) : '';
      const lat = body.lat ? Number(body.lat) : undefined;
      const lng = body.lng ? Number(body.lng) : undefined;
      
      if (!workoutId || !modality) {
        return c.json({ error: 'Os campos workoutId e modality são parâmetros obrigatórios.' }, 400);
      }

      const athlete = await athleteRepository.getPrimaryAthlete();
      if (athlete) {
        if (!location && lat !== undefined && lng !== undefined) {
          location = await getCityFromCoordinates(lat, lng);
        } else if (!location && athlete.homeLat && athlete.homeLon) {
          location = await getCityFromCoordinates(athlete.homeLat, athlete.homeLon);
        }
      }
      
      if (!location || location === 'Localização Mapeada' || location.includes('Sem API Key')) {
        location = 'São Paulo';
      }
      const weatherStr = await getTodayWeather(location);

      await workoutService.validateManualWorkout(workoutId, modality, mapPolyline, distance, weatherStr);
      return c.json({ data: { success: true, message: `Checklist manual validado (${modality})` } });
    } catch (error: unknown) {
      return c.json({ error: (error as Error).message }, 500);
    }
  }
};