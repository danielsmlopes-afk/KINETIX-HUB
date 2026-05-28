import { Hono } from 'hono';
import { runMorningRaceJob, runDailyBriefingJob, runRouteRecalculationJob, runWeeklyReportJob } from '../services/cronJobs';

export const debugRoutes = new Hono();

// Dispara manualmente os alertas matinais (D-3, D-2 e D-1)
debugRoutes.post('/trigger/morning-race', async (c) => {
  try {
    await runMorningRaceJob();
    return c.json({ success: true, message: 'Cronjob matinal (Morning Race) disparado com sucesso!' });
  } catch (error) {
    console.error(error);
    return c.json({ success: false, error: 'Erro ao executar o cronjob matinal.' }, 500);
  }
});

// Dispara manualmente o Briefing Noturno
debugRoutes.post('/trigger/nightly-briefing', async (c) => {
  try {
    await runDailyBriefingJob();
    return c.json({ success: true, message: 'Cronjob de Briefing Noturno disparado com sucesso!' });
  } catch (error) {
    console.error(error);
    return c.json({ success: false, error: 'Erro ao executar o cronjob de briefing.' }, 500);
  }
});

// Dispara manualmente o Recálculo de Rota (Compliance)
debugRoutes.post('/trigger/route-recalculation', async (c) => {
  try {
    await runRouteRecalculationJob();
    return c.json({ success: true, message: 'Cronjob de Recálculo disparado com sucesso!' });
  } catch (error) {
    console.error(error);
    return c.json({ success: false, error: 'Erro ao executar o cronjob de recálculo.' }, 500);
  }
});

// Dispara manualmente o Relatório Semanal em PDF (Dominical)
debugRoutes.post('/trigger/weekly-report', async (c) => {
  try {
    await runWeeklyReportJob();
    return c.json({ success: true, message: 'Cronjob de Relatório Semanal disparado com sucesso!' });
  } catch (error) {
    console.error(error);
    return c.json({ success: false, error: 'Erro ao executar o cronjob de relatório semanal.' }, 500);
  }
});