// Arquivo: src/controllers/athleteController.ts
import { Context } from 'hono';
import { athleteRepository } from '@/repositories/athleteRepository';

export const athleteController = {
  async getProfile(c: Context) {
    try {
      const athleteId = c.req.query('id');
      
      if (!athleteId) {
        return c.json({ error: "ID do atleta não fornecido na query.", code: "MISSING_PARAM" }, 400);
      }

      const athlete = await athleteRepository.getAthlete(athleteId);
      if (!athlete) return c.json({ error: "Atleta não encontrado.", code: "NOT_FOUND" }, 404);

      return c.json({ data: athlete });
    } catch (error) {
      return c.json({ error: "Erro ao buscar perfil do atleta.", code: "INTERNAL_ERR" }, 500);
    }
  }
};