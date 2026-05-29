import { Context } from 'hono';
import { workoutService } from '@/services/workoutService';

export const workoutController = {
  async validateManual(c: Context) {
    try {
      const body = await c.req.json();
      const { workoutId, modality } = body;
      
      if (!workoutId || !modality) {
        return c.json({ error: 'Os campos workoutId e modality são parâmetros obrigatórios.' }, 400);
      }

      await workoutService.validateManualWorkout(workoutId, modality);
      return c.json({ data: { success: true, message: `Checklist manual validado (${modality})` } });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  }
};