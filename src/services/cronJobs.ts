import cron from 'node-cron';
import { env } from '@/config/env';
import { telegramMessageService } from '@/services/telegramMessageService';
import { morningRaceService } from '@/services/morningRaceService';
import { briefingService } from '@/services/briefingService';
import { coachService } from '@/services/coachService';

export const initCronJobs = () => {
  console.log('⏳ Inicializando Relógio Mestre Biológico do KINETIX HUB...');

  // 07:00 - Morning Race Job
  cron.schedule('0 7 * * *', async () => {
    console.log('[Cron] Executando Morning Race Job');
    try {
      await morningRaceService.executeMorningRoutines();
    } catch (error) {
      console.error('[Cron] Falha no Morning Race Job:', error);
    }
  }, { timezone: 'America/Sao_Paulo' });

  // 14:59 (Domingo) - Varredura Longão Digital Twin
  cron.schedule('59 14 * * 0', async () => {
    console.log('[Cron] Executando Varredura do Longão (Digital Twin)');
    // Implementação da IA tática entra aqui
  }, { timezone: 'America/Sao_Paulo' });

  // 15:00 (Domingo) - Geração de Relatórios e Dossiês
  cron.schedule('0 15 * * 0', async () => {
    console.log('[Cron] Geração de Relatórios em PDF');
    // Acionamento do PDF Generator Service
  }, { timezone: 'America/Sao_Paulo' });

  // 22:30 - Daily Briefing e Logística
  cron.schedule('30 22 * * *', async () => {
    console.log('[Cron] Executando Daily Briefing');
    try {
      await briefingService.executeBriefing();
    } catch (error) {
      console.error('[Cron] Falha no Daily Briefing:', error);
    }
  }, { timezone: 'America/Sao_Paulo' });

  // 23:30 - Recálculo de Rotas / Auditoria de Compliance MISSED
  cron.schedule('30 23 * * *', async () => {
    console.log('[Cron] Executando Route Recalculation e Fechamento');
    // Implementação de auditoria tática
  }, { timezone: 'America/Sao_Paulo' });

  // ----------------------------------------------------------------------
  // NOVOS CRON-JOBS BIOLÓGICOS E LOGÍSTICOS
  // ----------------------------------------------------------------------

  // 1. Alerta de Carb-Loading (Sábados às 18h00)
  cron.schedule('0 18 * * 6', async () => {
    console.log('[Cron] Disparando Alerta de Carb-Loading Estratégico');
    const chatId = Number(env.TELEGRAM_CHAT_ID);
    const msg = `🍝 *Alerta Nutricional: Saturação de Carboidratos*\n\nComandante, prepare-se para o Longão de amanhã!\n\n- Inicie a saturação de carboidratos agora mesmo.\n- Reforce a hidratação (mínimo de 500ml de água antes de dormir).\n- Separe os géis e cápsulas de sal no seu arsenal logístico.\n\nBom descanso e foco absoluto na missão!`;
    await telegramMessageService.sendSimpleMessage(chatId, msg).catch(console.error);
  }, { timezone: 'America/Sao_Paulo' });

  // 2. Check-in Articular (Diário às 20h00)
  cron.schedule('0 20 * * *', async () => {
    console.log('[Cron] Disparando Check-in Articular Diário');
    const chatId = Number(env.TELEGRAM_CHAT_ID);
    const msg = `🦾 *Check-in Articular Diário*\n\nComo está o chassi hoje, comandante? Há algum desconforto agudo nos joelhos, panturrilhas ou ombro?\n\nSe existir alguma restrição clínica, responda com o comando:\n\`/dor <nota de 1 a 10> <local da dor>\`\n\n_Exemplo:_ \`/dor 4 joelho direito\``;
    await telegramMessageService.sendSimpleMessage(chatId, msg).catch(console.error);
  }, { timezone: 'America/Sao_Paulo' });
};