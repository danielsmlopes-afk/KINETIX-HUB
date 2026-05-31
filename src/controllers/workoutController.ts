import { Context } from 'hono';
import { workoutService } from '@/services/workoutService';

export const workoutController = {
  async validateManual(c: Context) {
    try {
      const body = await c.req.json();
      const { workoutId, modality, mapPolyline, distance } = body;
      
      if (!workoutId || !modality) {
        return c.json({ error: 'Os campos workoutId e modality são parâmetros obrigatórios.' }, 400);
      }

      await workoutService.validateManualWorkout(workoutId, modality, mapPolyline, distance);
      return c.json({ data: { success: true, message: `Checklist manual validado (${modality})` } });
    } catch (error: unknown) {
      return c.json({ error: (error as Error).message }, 500);
    }
  }
};