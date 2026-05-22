import { Context } from 'hono';
import { strengthRepository } from '@/repositories/strengthRepository';

export const strengthController = {
  async listTemplates(c: Context) {
    try {
      const templates = await strengthRepository.getAllWorkoutTemplates();
      
      return c.json({ data: templates });
    } catch (error) {
      console.error('❌ [STRENGTH CONTROLLER] Erro ao buscar fichas:', error);
      return c.json({ error: "Erro interno ao buscar as fichas de treino.", code: "FETCH_ERR" }, 500);
    }
  }
};