import { Context } from 'hono';
import { toggleMonitor } from '@/services/uptimeService';
import { acwrService } from '@/services/acwrService';
import { dbMaintenanceService } from '@/services/dbMaintenanceService';
import { weatherPacingService } from '@/services/weatherPacingService';
import { env } from '@/config/env';

export const webhookController = {
  toggleUptime: async (c: Context) => {
    // 1. Verificação de Segurança (A senha que configuramos)
    const secret = c.req.header('x-cron-secret');
    if (secret !== env.CRON_SECRET) {
      return c.json({ error: 'Unauthorized', code: 'AUTH_FAILED' }, 401);
    }

    try {
      // 2. Extração do payload (0 ou 1)
      const body = await c.req.json();
      const status = body.status;

      if (status !== 0 && status !== 1) {
        return c.json({ error: 'Status inválido. Use 0 ou 1.', code: 'BAD_REQUEST' }, 400);
      }

      // 3. Execução da ação
      await toggleMonitor(status);
      return c.json({ data: { message: `Comando enviado para status ${status}` } }, 200);

    } catch (error) {
      return c.json({ error: 'Erro ao processar webhook', code: 'INTERNAL_ERROR' }, 500);
    }
  },

  handleWeatherPacing: async (c: Context) => {
    const secret = c.req.header('x-cron-secret');
    if (secret !== env.CRON_SECRET) {
      return c.json({ error: 'Unauthorized', code: 'AUTH_FAILED' }, 401);
    }

    try {
      await weatherPacingService.checkUpcomingRaces();
      return c.json({ data: { message: 'Weather-Pacing executado e enviado com sucesso.' } }, 200);
    } catch (error) {
      return c.json({ error: 'Erro ao executar verificação de clima para provas.', code: 'WEATHER_PACING_ERR' }, 500);
    }
  },

  handleAcwrAudit: async (c: Context) => {
    const secret = c.req.header('x-cron-secret');
    if (secret !== env.CRON_SECRET) {
      return c.json({ error: 'Unauthorized', code: 'AUTH_FAILED' }, 401);
    }

    try {
      await acwrService.calculateWeeklyFatigue();
      return c.json({ data: { message: 'Auditoria de Fadiga Semanal (ACWR) concluída.' } }, 200);
    } catch (error) {
      return c.json({ error: 'Erro ao calcular auditoria ACWR.', code: 'ACWR_AUDIT_ERR' }, 500);
    }
  },

  handleDbMaintenance: async (c: Context) => {
    const secret = c.req.header('x-cron-secret');
    if (secret !== env.CRON_SECRET) {
      return c.json({ error: 'Unauthorized', code: 'AUTH_FAILED' }, 401);
    }

    try {
      await dbMaintenanceService.runMaintenanceTasks();
      return c.json({ data: { message: 'Manutenção do banco de dados concluída.' } }, 200);
    } catch (error) {
      return c.json({ error: 'Erro durante a manutenção do banco de dados.', code: 'DB_MAINTENANCE_ERR' }, 500);
    }
  }
};
