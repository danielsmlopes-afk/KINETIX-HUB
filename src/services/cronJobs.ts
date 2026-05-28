import cron from 'node-cron';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { plannedWorkouts, cronLogs, workoutSessions, pendingActions, races } from '@/db/schema';
import { athleteRepository } from '@/repositories/athleteRepository';
import { briefingService } from './briefingService';
import { env } from '@/config/env';
import { askHeadCoach, askHeadCoachForRecalculation } from './headCoachService';
import { morningRaceService } from './morningRaceService';
import { macrocycleService } from './macrocycleService';
import { StravaService } from './stravaService';
import { generateWorkoutReportHtml } from './workoutReportGenerator';
// @ts-ignore
import weasyprint from 'weasyprint-wrapper';

/**
 * 🛡️ BLINDAGEM DE FUSO-HORÁRIO (UTC-3): Evita a "Meia-Noite Fantasma" de servidores remotos.
 */
const getSPDate = () => {
  const spDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return new Date(`${spDateStr}T00:00:00`);
};

export async function runMacrocycleQueueJob() {
  try {
    const athlete = await athleteRepository.getPrimaryAthlete();
    if (!athlete) return;

    const jobs = await db.select().from(pendingActions).where(
      and(eq(pendingActions.athleteId, athlete.id), eq(pendingActions.action, 'GENERATE_MACROCYCLE'))
    ).limit(1);

    if (jobs.length === 0) return;

    const job = jobs[0];
    console.log(`⏳ Iniciando processamento do Macrociclo (Job ID: ${job.id}) no Motor IA...`);

    const payload = JSON.parse(job.notes || '{}');
    if (payload.raceName && payload.distance && payload.raceDate) {
      await macrocycleService.generateMacrocycle(
        payload.raceName,
        payload.distance,
        new Date(payload.raceDate),
        payload.priority || 'P1',
        payload.raceId
      );
    }

    await db.delete(pendingActions).where(eq(pendingActions.id, job.id));
    console.log(`✅ Job de Macrociclo processado e removido da fila.`);

  } catch (error) {
    console.error('❌ Erro na execução do Task Runner de Macrociclo:', error);
  }
}

export async function runDailyBriefingJob() {
  let status = 'SUCCESS';
  let logMessage = 'Briefing diário enviado com sucesso.';

  try {
    console.log('⏳ Iniciando Cron: Verificação de treino para o Briefing Diário...');
    
    const athlete = await athleteRepository.getPrimaryAthlete();
    if (!athlete) return;

    const tomorrow = getSPDate();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);

    const workouts = await db.select().from(plannedWorkouts).where(
      and(
        eq(plannedWorkouts.athleteId, athlete.id),
        gte(plannedWorkouts.date, tomorrow),
        lte(plannedWorkouts.date, endOfTomorrow)
      )
    ).limit(1);

    if (workouts.length === 0) {
      console.log('✅ Cron: Sem treino planejado para amanhã. Briefing pulado.');
      return;
    }

    const briefing = await briefingService.generateNightlyBriefing(workouts[0]);
    
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const telegramResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: briefing, parse_mode: 'Markdown' })
    });

    if (!telegramResponse.ok) {
      throw new Error('Falha na comunicação com a API do Telegram.');
    }
    
    console.log('✅ Cron: Briefing diário enviado com sucesso.');
  } catch (error) {
    status = 'ERROR';
    logMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro na execução do Cron Job:', error);
  } finally {
    try {
      await db.insert(cronLogs).values({
        jobName: 'Daily Briefing',
        status,
        message: logMessage
      });
      console.log('📝 Log do Cron salvo no banco de dados.');
    } catch (logError) {
      console.error('❌ Erro ao salvar log do Cron no banco:', logError);
    }
  }
}

export async function runRouteRecalculationJob() {
  let status = 'SUCCESS';
  let logMessage = 'Análise de compliance de treino concluída.';

  try {
    console.log('⏳ Iniciando Cron: Recálculo de Rota (Compliance)...');
    const athlete = await athleteRepository.getPrimaryAthlete();
    if (!athlete) return;

    const today = getSPDate();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    // 1. Verifica qual era o treino planejado para HOJE
    const plannedToday = await db.select().from(plannedWorkouts).where(
      and(
        eq(plannedWorkouts.athleteId, athlete.id),
        gte(plannedWorkouts.date, startOfToday),
        lte(plannedWorkouts.date, endOfToday)
      )
    );

    if (plannedToday.length === 0) {
      console.log('✅ Nenhum treino planejado para hoje. Dia de descanso respeitado.');
      return; 
    }

    // 2. Verifica se houve treino registrado no Strava HOJE
    const sessionsToday = await db.select().from(workoutSessions).where(
      and(
        eq(workoutSessions.athleteId, athlete.id),
        gte(workoutSessions.date, startOfToday),
        lte(workoutSessions.date, endOfToday)
      )
    );

    if (sessionsToday.length > 0) {
      console.log('✅ Treino de hoje concluído e validado no radar do Strava!');
      return; 
    }

    // 3. TREINO PULADO! Pede ajuda ao Head Coach passando a próxima semana como contexto
    console.log('⚠️ Treino pulado detectado. Acionando Head Coach IA...');
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const upcomingWorkouts = await db.select().from(plannedWorkouts).where(
      and(eq(plannedWorkouts.athleteId, athlete.id), gte(plannedWorkouts.date, endOfToday), lte(plannedWorkouts.date, nextWeek))
    ).orderBy(plannedWorkouts.date);

    const missedWorkout = plannedToday[0];
    const prompt = `O atleta não registrou o treino de hoje (${missedWorkout.activityType} - ${missedWorkout.title}, ID: ${missedWorkout.id}) no radar do Strava. Com base na planilha dos próximos 7 dias, aplique o recálculo necessário na agenda. Retorne o JSON com as ações ('RESCHEDULE' ou 'CANCEL') e a nova data se necessário.`;
    
    const aiResponse = await askHeadCoachForRecalculation(prompt, { treinoPerdido: missedWorkout, proximosTreinos: upcomingWorkouts });

    // 4. Prepara as Sugestões Estruturadas (Humano no Ciclo - NÃO altera o banco sozinho)
    // Limpa sugestões antigas que não foram aprovadas
    await db.delete(pendingActions).where(eq(pendingActions.athleteId, athlete.id));

    for (const update of aiResponse.updates || []) {
      if (update.action === 'CANCEL') {
        console.log(`🗑️ Sugestão da IA: Cancelar treino ${update.id}.`);
      } else if (update.action === 'RESCHEDULE' && update.newDate) {
        console.log(`📅 Sugestão da IA: Reagendar treino ${update.id} para ${update.newDate}.`);
      }
      
      await db.insert(pendingActions).values({
        athleteId: athlete.id,
        workoutId: update.id,
        action: update.action,
        newDate: update.newDate ? new Date(update.newDate) : null,
        notes: update.notes
      });
    }

    const actionsText = (aiResponse.updates && aiResponse.updates.length > 0)
      ? aiResponse.updates.map(u => `  🔸 *${u.action}*: ${u.notes || 'Revisar'}`).join('\n')
      : "  🔸 Nenhuma alteração direta no calendário realizada.";

    const message = `🚨 *SUGESTÃO DE RECÁLCULO DE ROTA*\n\nO seu treino de hoje (*${missedWorkout.title}*) não foi detectado na telemetria.\n\n🛠️ *Ações Sugeridas para o Calendário:*\n${actionsText}\n\n🧠 *Tática do Head Coach:*\n${aiResponse.advice}\n\n👉 *Responda com "OK" para aprovar e aplicar estas mudanças.*`;

    const telegramResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' })
    });
    
    if (!telegramResponse.ok) {
      console.warn('⚠️ Telegram rejeitou a formatação Markdown da IA. Enviando como texto puro...');
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message })
      });
    }
    
    console.log('✅ Cron: Alerta de recálculo enviado ao Telegram com sucesso.');
    logMessage = 'Treino pulado. Alerta de recálculo enviado ao Telegram.';
  } catch (error) {
    status = 'ERROR';
    logMessage = error instanceof Error ? error.message : 'Erro no Recálculo';
    console.error('❌ Erro no Cron de Recálculo:', error);
  } finally {
    try { await db.insert(cronLogs).values({ jobName: 'Route Recalculation', status, message: logMessage }); } catch (e) {}
  }
}

export async function runMorningRaceJob() {
  let status = 'SUCCESS';
  let logMessage = 'Rotina matinal pré-prova executada com sucesso.';

  try {
    console.log('⏳ Iniciando Cron: Morning Race Service (D-3, D-2, D-1)...');
    const athlete = await athleteRepository.getPrimaryAthlete();
    if (!athlete) return;

    const today = getSPDate();
    today.setHours(0, 0, 0, 0);

    const next3Days = new Date(today);
    next3Days.setDate(next3Days.getDate() + 4);

    const upcomingRaces = await db.select().from(races).where(
      and(gte(races.date, today), lte(races.date, next3Days))
    );

    for (const race of upcomingRaces) {
      const rDate = new Date(race.date);
      rDate.setHours(0, 0, 0, 0);

      const diffTime = rDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      let message = '';
      if (diffDays === 3) message = await morningRaceService.processD3(athlete.id, race);
      else if (diffDays === 2) message = await morningRaceService.processD2(race);
      else if (diffDays === 1) message = await morningRaceService.processD1(athlete, race);

      if (message) {
        const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        const telegramResponse = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message, parse_mode: 'MarkdownV2' }) });
        if (!telegramResponse.ok) {
          console.warn('⚠️ Telegram rejeitou a formatação MarkdownV2 da IA. Enviando como texto puro...');
          await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message }) });
        }
      }
    }
    console.log('✅ Cron: Morning Race Service finalizado.');
  } catch (error) {
    status = 'ERROR';
    logMessage = error instanceof Error ? error.message : 'Erro no Morning Race Service';
    console.error('❌ Erro no Cron Morning Race:', error);
  } finally {
    try { await db.insert(cronLogs).values({ jobName: 'Morning Race Job', status, message: logMessage }); } catch (e) {}
  }
}

export async function runWeeklyReportJob() {
  let status = 'SUCCESS';
  let logMessage = 'Relatório Semanal em PDF gerado e enviado.';

  try {
    console.log('⏳ Iniciando Cron: Relatório Semanal (WeasyPrint)...');
    const athlete = await athleteRepository.getPrimaryAthlete();
    if (!athlete) return;

    const today = getSPDate();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999);

    const workouts = await db.select().from(plannedWorkouts).where(
      and(eq(plannedWorkouts.athleteId, athlete.id), gte(plannedWorkouts.date, today), lte(plannedWorkouts.date, nextWeek))
    ).orderBy(plannedWorkouts.date);

    // 1. Geração HTML (WeasyPrint Compliance)
    const html = generateWorkoutReportHtml(workouts as any);

    // 2. ENGINE DE COMPILAÇÃO WEASYPRINT EM BACKGROUND (Buffer PDF Real)
    const pdfBuffer = await weasyprint(html);

    // 3. Despacho do PDF via Telegram
    const formData = new FormData();
    formData.append('chat_id', env.TELEGRAM_CHAT_ID);
    formData.append('document', new Blob([pdfBuffer]), 'Planilha_Semanal_Kinetix_V12.pdf');
    formData.append('caption', '📊 *Dossiê Semanal V12.2*\nO seu mapa tático para os próximos 7 dias.');

    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    console.log('✅ Cron: Relatório Semanal enviado.');
  } catch (error) {
    status = 'ERROR';
    logMessage = error instanceof Error ? error.message : 'Erro no Relatório Semanal';
    console.error('❌ Erro no Cron Weekly Report:', error);
  } finally {
    try { await db.insert(cronLogs).values({ jobName: 'Weekly PDF Report', status, message: logMessage }); } catch (e) {}
  }
}

export async function runEnduranceScanJob() {
  try {
    const stravaService = new StravaService();
    await stravaService.scanAndLogEnduranceRun();
  } catch (error) {
    console.error('❌ Erro no Cron de Varredura de Endurance:', error);
  }
}

export function startCronJobs() {
  const opts = { timezone: 'America/Sao_Paulo' };

  // Rotina Matinal (D-3, D-2, D-1 da Prova): Todos os dias às 07:00
  cron.schedule('0 7 * * *', runMorningRaceJob, opts);

  // Varredura de Endurance (Digital Twin): Domingos às 14:59
  cron.schedule('59 14 * * 0', runEnduranceScanJob, opts);

  // Relatório Dominical de Exportação (WeasyPrint): Domingos às 15:00
  cron.schedule('0 15 * * 0', runWeeklyReportJob, opts);

  // Disparo Diário de Briefing Tático do dia seguinte: Às 22:30
  cron.schedule('30 22 * * *', runDailyBriefingJob, opts);

  // Recálculo de Rota (Compliance de Treino): Todos os dias às 23:30
  cron.schedule('30 23 * * *', runRouteRecalculationJob, opts);

  // Task Runner Assíncrono para operações pesadas de IA: A cada 5 minutos
  cron.schedule('*/5 * * * *', runMacrocycleQueueJob, opts);
}