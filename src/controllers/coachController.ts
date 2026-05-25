import { Context } from 'hono';
import { coachService } from '@/services/coachService';

export const coachController = {
  async updateCompliance(c: Context) {
    try {
      const id = c.req.param('id');
      if (!id) {
        return c.json({ error: 'ID do treino não fornecido.', code: 'MISSING_ID' }, 400);
      }

      const body = await c.req.json().catch(() => ({}));
      const { status } = body;
      
      if (!['VALIDATED', 'MISSED', 'COMPLETED_NOT_VALIDATED'].includes(status)) {
        return c.json({ error: 'Status inválido.', code: 'INVALID_STATUS' }, 400);
      }

      await coachService.updateComplianceStatus(id, status);
      return c.json({ data: { success: true, status } });
    } catch (error) {
      console.error('[COACH_CTRL] Erro ao atualizar compliance:', error);
      return c.json({ error: 'Falha ao atualizar compliance' }, 500);
    }
  }
};
