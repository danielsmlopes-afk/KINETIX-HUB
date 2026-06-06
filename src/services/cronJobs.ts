import cron from 'node-cron';
import { env } from '@/config/env';
import { telegramMessageService } from '@/services/telegramMessageService';

const localWebhookUrl = `http://localhost:${env.PORT || 3000}/api/webhook`;

export const runMorningRaceJob = async () => {
  console.log('[Cron] Acionando Gateway Webhook: Morning Race Job');
  await fetch(`${localWebhookUrl}/manual-trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': env.CRON_SECRET },
    body: JSON.stringify({ jobId: 'MORNING_RACE' })
  }).catch(err => console.error('[Cron] Falha de comunicação interna:', err));
};

export const runDailyBriefingJob = async () => {
  console.log('[Cron] Acionando Gateway Webhook: Daily Briefing');
  await fetch(`${localWebhookUrl}/manual-trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': env.CRON_SECRET },
    body: JSON.stringify({ jobId: 'DAILY_BRIEFING' })
  }).catch(err => console.error('[Cron] Falha de comunicação interna:', err));
};

export const runRouteRecalculationJob = async () => {
  console.log('[Cron] Executando Route Recalculation e Fechamento');
  // Futuro: Implementar chamada de webhook para recalculo assim que o endpoint nativo existir.
};

export const runWeeklyReportJob = async () => {
  console.log('[Cron] Acionando Gateway Webhook: Geração de Relatórios em PDF (Dominical)');
  await fetch(`${localWebhookUrl}/weekly-report`, {
    method: 'POST',
    headers: { 'x-cron-secret': env.CRON_SECRET }
  }).catch(err => console.error('[Cron] Falha de comunicação interna:', err));
};

export const runDigitalTwinJob = async () => {
  console.log('[Cron] Acionando Gateway Webhook: Varredura do Longão (Digital Twin)');
  await fetch(`${localWebhookUrl}/digital-twin`, {
    method: 'POST',
    headers: { 'x-cron-secret': env.CRON_SECRET }
  }).catch(err => console.error('[Cron] Falha de comunicação interna:', err));
};

export const startCronJobs = () => initCronJobs();

export const initCronJobs = () => {
  // 🛡️ Environment Guard: Evita duplicidade se os crons forem engatilhados por Webhook externo
  if (process.env.DISABLE_INTERNAL_CRONS === 'true') {
    console.log('🛡️ [Kinetix] Internal Crons disabled (Delegated to external Webhooks).');
    return;
  }

  console.log('⏳ Inicializando Relógio Mestre Biológico do KINETIX HUB...');

  // 07:00 - Morning Race Job
  cron.schedule('0 7 * * *', runMorningRaceJob, { timezone: 'America/Sao_Paulo' });

  // 14:59 (Domingo) - Varredura Longão Digital Twin
  cron.schedule('59 14 * * 0', runDigitalTwinJob, { timezone: 'America/Sao_Paulo' });

  // 15:00 (Domingo) - Geração de Relatórios e Dossiês
  cron.schedule('0 15 * * 0', runWeeklyReportJob, { timezone: 'America/Sao_Paulo' });

  // 22:30 - Daily Briefing e Logística
  cron.schedule('30 22 * * *', runDailyBriefingJob, { timezone: 'America/Sao_Paulo' });

  // 23:30 - Recálculo de Rotas / Auditoria de Compliance MISSED
  cron.schedule('30 23 * * *', runRouteRecalculationJob, { timezone: 'America/Sao_Paulo' });

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