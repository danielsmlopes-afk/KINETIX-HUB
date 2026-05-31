import { Context } from 'hono';
import { toggleMonitor } from '@/services/uptimeService';
import { acwrService } from '@/services/acwrService';
import { dbMaintenanceService } from '@/services/dbMaintenanceService';
import { weatherPacingService } from '@/services/weatherPacingService';
import { morningRaceService } from '@/services/morningRaceService';
import { briefingService } from '@/services/briefingService';
import { env } from '@/config/env';
import { athleteRepository } from '@/repositories/athleteRepository';
import { generateLogbookPdf } from '@/services/pdf/logbookService';
import { generateCareerHistoryPdf } from '@/services/pdf/careerHistoryService';
import { cardioEfficiencyService } from '@/services/pdf/cardioEfficiencyService';
import { generateRaceBriefingPdf } from '@/services/pdf/raceBriefingService';

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
  },

  handleManualTrigger: async (c: Context) => {
    const secret = c.req.header('x-cron-secret');
    if (secret !== env.CRON_SECRET) {
      return c.json({ error: 'Unauthorized', code: 'AUTH_FAILED' }, 401);
    }

    try {
      const body = await c.req.json() as { jobId?: string };
      const jobId = body.jobId;

      switch (jobId) {
        case 'MORNING_RACE':
          await morningRaceService.executeMorningRoutines();
          break;
        case 'DAILY_BRIEFING':
          await briefingService.executeBriefing();
          break;
        default:
          return c.json({ error: 'JobId inválido ou não suportado.', code: 'BAD_REQUEST' }, 400);
      }
      return c.json({ data: { message: `Gatilho ${jobId} disparado com sucesso.` } }, 200);
    } catch (error) {
      return c.json({ error: 'Erro ao processar disparo manual.', code: 'MANUAL_TRIGGER_ERR' }, 500);
    }
  },

  triggerWeeklyReport: async (c: Context) => {
    const secret = c.req.header('x-cron-secret');
    if (secret !== env.CRON_SECRET) {
      return c.text('Unauthorized', 401);
    }

    // Fire and forget
    (async () => {
      try {
        const athlete = await athleteRepository.getPrimaryAthlete();
        const athleteId = athlete?.id || 'primary-athlete';
        await generateLogbookPdf('Ciclo Ativo');
        await generateCareerHistoryPdf(athleteId);
      } catch (error) {
        console.error('❌ [Webhook] Erro no triggerWeeklyReport:', error);
      }
    })();
    return c.text('OK', 200);
  },

  triggerMonthlyReport: async (c: Context) => {
    const secret = c.req.header('x-cron-secret');
    if (secret !== env.CRON_SECRET) {
      return c.text('Unauthorized', 401);
    }

    (async () => {
      try {
        const athlete = await athleteRepository.getPrimaryAthlete();
        const athleteId = athlete?.id || 'primary-athlete';
        await cardioEfficiencyService.generateCardioReportPdf(athleteId, 'Geral');
      } catch (error) {
        console.error('❌ [Webhook] Erro no triggerMonthlyReport:', error);
      }
    })();
    return c.text('OK', 200);
  },

  triggerRaceBriefing: async (c: Context) => {
    const secret = c.req.header('x-cron-secret');
    if (secret !== env.CRON_SECRET) {
      return c.text('Unauthorized', 401);
    }

    (async () => {
      try {
        let raceId = 'SP-21K'; // Fallback
        try {
          const body = await c.req.json();
          if (body && body.raceId) raceId = body.raceId;
        } catch (e) {} // Continua silenciosamente se não houver JSON
        
        await generateRaceBriefingPdf(raceId);
      } catch (error) {
        console.error('❌ [Webhook] Erro no triggerRaceBriefing:', error);
      }
    })();
    return c.text('OK', 200);
  }
};
