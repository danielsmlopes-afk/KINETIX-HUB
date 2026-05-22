import cron from 'node-cron';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { plannedWorkouts, cronLogs, workoutSessions, pendingActions } from '@/db/schema';
import { athleteRepository } from '@/repositories/athleteRepository';
import { generateDailyBriefing } from './briefingService';
import { env } from '@/config/env';
import { getTomorrowWeather } from './weatherService';
import { askHeadCoach, askHeadCoachForRecalculation } from './headCoachService';

interface UptimeRobotResponse {
  stat: string;
  error?: {
    message: string;
  };
}

export async function runDailyBriefingJob() {
  let status = 'SUCCESS';
  let logMessage = 'Briefing diário enviado com sucesso.';

  try {
    console.log('⏳ Iniciando Cron: Verificação de treino para o Briefing Diário...');
    
    const athlete = await athleteRepository.getPrimaryAthlete();
    if (!athlete) {
      status = 'ERROR';
      logMessage = 'Atleta principal não encontrado no banco.';
      console.error('❌ Cron abortado: Atleta principal não encontrado no banco.');
      return;
    }

    // Calcula o limite de início e fim do dia de "amanhã"
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfTomorrow = new Date(tomorrow.setHours(0, 0, 0, 0));
    const endOfTomorrow = new Date(tomorrow.setHours(23, 59, 59, 999));

    const workoutsTomorrow = await db.select().from(plannedWorkouts).where(
      and(
        eq(plannedWorkouts.athleteId, athlete.id),
        gte(plannedWorkouts.date, startOfTomorrow),
        lte(plannedWorkouts.date, endOfTomorrow)
      )
    );

    let workoutDetails = "Nenhum treino agendado para amanhã. Dia de descanso!";
    const targetCity = process.env.WEATHER_CITY || 'São Paulo';
    let weatherForecast = await getTomorrowWeather(targetCity); 
    let activityEmoji = '💤'; // Dia de descanso (default)
    let isRestDay = true;
    
    if (workoutsTomorrow.length > 0) {
      const w = workoutsTomorrow[0];
      isRestDay = false;

      // Lógica de Emojis dinâmicos conforme a modalidade
      if (w.activityType === 'RUN') activityEmoji = '🏃‍♂️';
      else if (w.activityType === 'BIKE') activityEmoji = '🚴‍♂️';
      else if (w.activityType === 'STRENGTH') activityEmoji = '🏋️‍♂️';
      
      let detailsStr = '';
      if (w.details && typeof w.details === 'object') {
        const entries = Object.entries(w.details);
        if (entries.length > 0) {
          detailsStr = '\n' + entries.map(([k, v]) => {
            // Deixa a chave mais legível em "Title Case" (ex: distanceKm -> Distance Km)
            const formattedKey = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            return `  🔸 *${formattedKey}:* ${v}`;
          }).join('\n');
        }
      }

      workoutDetails = `${w.activityType} - ${w.title}${detailsStr}`;
    }

    const briefing = generateDailyBriefing(workoutDetails, weatherForecast, activityEmoji, isRestDay);
    
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

    const today = new Date();
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

export async function toggleMonitor(status: 0 | 1) {
  try {
    console.log(`⏳ [UptimeRobot] Solicitando alteração do monitor para status: ${status === 1 ? 'Ativo' : 'Pausado'}...`);
    const url = 'https://api.uptimerobot.com/v2/editMonitor';
    
    const bodyParams = new URLSearchParams({
      api_key: env.UPTIMEROBOT_API_KEY,
      format: 'json',
      id: env.UPTIMEROBOT_MONITOR_ID,
      status: status.toString()
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString()
    });

    const data = await response.json() as UptimeRobotResponse;
    if (data.stat !== 'ok') {
      throw new Error(`Erro retornado pela API: ${data.error?.message || 'Desconhecido'}`);
    }

    console.log(`✅ [UptimeRobot] Monitor atualizado com sucesso. Novo status: ${status === 1 ? 'Ativo' : 'Pausado'}.`);
  } catch (error) {
    console.error(`❌ [UptimeRobot] Erro ao alternar o monitor:`, error);
  }
}

export function startCronJobs() {
  // Disparo diário às 22h00
  cron.schedule('0 22 * * *', runDailyBriefingJob);

  // UptimeRobot: Pausar monitoramento às 00:01
  cron.schedule('1 0 * * *', () => toggleMonitor(0));

  // UptimeRobot: Retomar monitoramento às 05:59
  cron.schedule('59 5 * * *', () => toggleMonitor(1));

  // Recálculo de Rota (Compliance de Treino): Todos os dias às 23:30
  cron.schedule('30 23 * * *', runRouteRecalculationJob);
}