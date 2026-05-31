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
import { telegramMessageService } from '@/services/telegramMessageService';
import { StravaService } from '@/services/stravaService';
import { db } from '@/db';
import { plannedWorkouts } from '@/db/schema';
import { eq, and, sql, isNull, gte, lte } from 'drizzle-orm';
import { coachService } from '@/services/coachService';
import { askHeadCoachForRecalculation } from '@/services/headCoachService';

export const webhookController = {
  toggleUptime: async (c: Context) => {
    // 1. Verificação de Segurança (A senha que configuramos)
    const secret = c.req.header('x-cron-secret');
    if (secret !== env.CRON_SECRET) {
      return c.json({ error: 'Unauthorized', code: 'AUTH_FAILED' }, 401);
    }

    try {
      // 2. Extração do payload (0 ou 1)
      const body = await c.req.json().catch(() => ({}));
      const status = body.status;

      if (status !== 0 && status !== 1) {
        return c.json({ data: { message: 'Ping de Uptime recebido sem alteração de status.' } }, 200);
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
        const chatId = Number(env.TELEGRAM_CHAT_ID);
        
        const logbookBuffer = await generateLogbookPdf('Ciclo Ativo');
        if (logbookBuffer) {
          await telegramMessageService.sendPdfReport(chatId, logbookBuffer, 'Diario_de_Viagem.pdf', '📄 *DIÁRIO DE VIAGEM (LOGBOOK)*\n\nComandante, a operação semanal foi encerrada. Segue em anexo a topografia de Carga Aguda vs Crônica e o balanço do seu Macrociclo.');
        }

        const careerBuffer = await generateCareerHistoryPdf(athleteId);
        if (careerBuffer) {
          await telegramMessageService.sendPdfReport(chatId, careerBuffer, 'Historico_Carreira.pdf', '🎖️ *HISTÓRICO DE COMBATE*\n\nSeu dossiê de carreira foi atualizado com sucesso.');
        }
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
        const chatId = Number(env.TELEGRAM_CHAT_ID);
        const cardioBuffer = await cardioEfficiencyService.generateCardioReportPdf(athleteId, 'Geral');
        if (cardioBuffer) {
          await telegramMessageService.sendPdfReport(chatId, cardioBuffer, 'RaioX_Cardio.pdf', '🫀 *RAIO-X CARDIOVASCULAR*\n\nAnálise de eficiência cardiorrespiratória do mês gerada com sucesso.');
        }
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
        
        const chatId = Number(env.TELEGRAM_CHAT_ID);
        const briefingBuffer = await generateRaceBriefingPdf(raceId);
        if (briefingBuffer) {
          await telegramMessageService.sendPdfReport(chatId, briefingBuffer, `RaceBriefing_${raceId}.pdf`, `🎯 *PRONTUÁRIO DE PROVA: ${raceId}*\n\nTabela Smart Pace e Fatores Climáticos na Largada calculados com êxito.`);
        }
      } catch (error) {
        console.error('❌ [Webhook] Erro no triggerRaceBriefing:', error);
      }
    })();
    return c.text('OK', 200);
  },

  triggerDigitalTwin: async (c: Context) => {
    const secret = c.req.header('x-cron-secret');
    if (secret !== env.CRON_SECRET) {
      return c.text('Unauthorized', 401);
    }

    (async () => {
      try {
        const stravaService = new StravaService();
        await stravaService.scanAndLogEnduranceRun();
      } catch (error) {
        console.error('❌ [Webhook] Erro no triggerDigitalTwin:', error);
      }
    })();
    return c.text('OK', 200);
  },

  triggerRouteRecalculation: async (c: Context) => {
    const secret = c.req.header('x-cron-secret');
    if (secret !== env.CRON_SECRET) {
      return c.text('Unauthorized', 401);
    }

    (async () => {
      try {
        console.log('[Webhook] Executando Route Recalculation e Auditoria Noturna...');
        const athlete = await athleteRepository.getPrimaryAthlete();
        if (!athlete) return;

        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        const today = new Date(`${todayStr}T00:00:00Z`);

        // 1. Auditar e cravar MISSED em treinos planejados para hoje que não foram validados
        const pendingToday = await db.select().from(plannedWorkouts).where(
          and(eq(plannedWorkouts.athleteId, athlete.id), sql`DATE(${plannedWorkouts.date}) = ${todayStr}`, isNull(plannedWorkouts.complianceStatus))
        );
        
        for (const workout of pendingToday) {
          await coachService.updateComplianceStatus(workout.id, 'MISSED');
        }

        // 2. Se houver falhas, invoca a IA para recalcular a rota da semana
        const missedToday = await db.select().from(plannedWorkouts).where(
          and(eq(plannedWorkouts.athleteId, athlete.id), sql`DATE(${plannedWorkouts.date}) = ${todayStr}`, eq(plannedWorkouts.complianceStatus, 'MISSED'))
        );

        if (missedToday.length > 0) {
          console.log(`[Webhook] ${missedToday.length} treino(s) MISSED. Acionando Head Coach para recálculo...`);
          
          const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
          const nextWeek = new Date(tomorrow); nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

          const upcoming = await db.select().from(plannedWorkouts).where(
            and(eq(plannedWorkouts.athleteId, athlete.id), gte(plannedWorkouts.date, tomorrow), lte(plannedWorkouts.date, nextWeek))
          );

          const contextData = {
            treinosPerdidos: missedToday.map(w => ({ id: w.id, type: w.activityType, title: w.title, details: w.details })),
            proximosTreinos: upcoming.map(w => ({ id: w.id, date: w.date.toISOString(), type: w.activityType, title: w.title }))
          };

          const aiResponse = await askHeadCoachForRecalculation("Falha operacional hoje. Por favor, ajuste o restante da semana compensando volume perdido sem sobrecarregar.", contextData);

          let updatesMsg = '';
          for (const update of aiResponse.updates) {
            if (update.action === 'CANCEL') {
              await db.delete(plannedWorkouts).where(eq(plannedWorkouts.id, update.id));
              updatesMsg += `\n❌ Cancelado: ${update.notes}`;
            } else if (update.action === 'RESCHEDULE' && update.newDate) {
              await db.update(plannedWorkouts).set({ date: new Date(update.newDate) }).where(eq(plannedWorkouts.id, update.id));
              updatesMsg += `\n📅 Reagendado: ${update.newDate.split('T')[0]} - ${update.notes}`;
            }
          }

          const msg = `⚠️ *ROTA RECALCULADA (COMPLIANCE MISSED)* ⚠️\n\nO Head Coach detectou falha no cumprimento da missão de hoje e ajustou o seu calendário.\n\n🧠 *Parecer da IA:*\n${aiResponse.advice}\n\n⚙️ *Ações Tomadas:*${updatesMsg || '\nNenhuma alteração estrutural.'}`;
          await telegramMessageService.sendSimpleMessage(Number(env.TELEGRAM_CHAT_ID), msg);
        } else {
          console.log('[Webhook] Compliance 100%. Nenhum recálculo necessário.');
        }
      } catch (error) {
        console.error('❌ [Webhook] Erro no triggerRouteRecalculation:', error);
      }
    })();
    return c.text('OK', 200);
  },

  triggerCarbLoading: async (c: Context) => {
    const secret = c.req.header('x-cron-secret');
    if (secret !== env.CRON_SECRET) {
      return c.text('Unauthorized', 401);
    }

    (async () => {
      try {
        console.log('[Webhook] Disparando Alerta de Carb-Loading Estratégico');
        const chatId = Number(env.TELEGRAM_CHAT_ID);
        const msg = `🍝 *Alerta Nutricional: Saturação de Carboidratos*\n\nComandante, prepare-se para o Longão de amanhã!\n\n- Inicie a saturação de carboidratos agora mesmo.\n- Reforce a hidratação (mínimo de 500ml de água antes de dormir).\n- Separe os géis e cápsulas de sal no seu arsenal logístico.\n\nBom descanso e foco absoluto na missão!`;
        await telegramMessageService.sendSimpleMessage(chatId, msg);
      } catch (error) {
        console.error('❌ [Webhook] Erro no triggerCarbLoading:', error);
      }
    })();
    return c.text('OK', 200);
  },

  triggerJointCheckin: async (c: Context) => {
    const secret = c.req.header('x-cron-secret');
    if (secret !== env.CRON_SECRET) {
      return c.text('Unauthorized', 401);
    }

    (async () => {
      try {
        console.log('[Webhook] Disparando Check-in Articular Diário');
        const chatId = Number(env.TELEGRAM_CHAT_ID);
        const msg = `🦾 *Check-in Articular Diário*\n\nComo está o chassi hoje, comandante? Há algum desconforto agudo nos joelhos, panturrilhas ou ombro?\n\nSe existir alguma restrição clínica, responda com o comando:\n\`/dor <nota de 1 a 10> <local da dor>\`\n\n_Exemplo:_ \`/dor 4 joelho direito\``;
        await telegramMessageService.sendSimpleMessage(chatId, msg);
      } catch (error) {
        console.error('❌ [Webhook] Erro no triggerJointCheckin:', error);
      }
    })();
    return c.text('OK', 200);
  }
};
