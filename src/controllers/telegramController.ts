import { Context } from 'hono';
import { db } from '@/db';
import { athletes, plannedWorkouts, bioimpedanceLogs, pendingActions, races } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { telegramMessageService } from '@/services/telegramMessageService';
import crypto from 'crypto';

export const telegramController = {
  async handleWebhook(c: Context) {
    try {
      const update = await c.req.json();

      // ======================================================================
      // 1. Processamento de Callback Queries (Teclado Inline - VALIDADOR MANUAL)
      // ======================================================================
      if (update.callback_query) {
        const callbackData = update.callback_query.data as string;
        const chatId = update.callback_query.message.chat.id as number;
        const messageId = update.callback_query.message.message_id as number;

        const cmdMap: Record<string, string> = {
          'cmd_provaalvo': '/provaalvo',
          'cmd_hoje': '/hoje',
          'cmd_briefing': '/briefing',
          'cmd_auditoria': '/auditoria',
          'cmd_peso': '/peso',
          'cmd_dor': '/dor'
        };

        if (cmdMap[callbackData]) {
          update.message = { text: cmdMap[callbackData], chat: { id: chatId } };
        } else {
          if (callbackData.startsWith('checkin_')) {
          const type = callbackData.split('_')[1]; // STRENGTH ou BIKE
          const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
          
          const athleteList = await db.select().from(athletes).limit(1);
          if (athleteList.length > 0) {
            const athlete = athleteList[0];
            
            // Busca o treino planejado para hoje com o tipo especificado
            const planned = await db.select()
              .from(plannedWorkouts)
              .where(
                and(
                  eq(plannedWorkouts.athleteId, athlete.id),
                  sql`DATE(${plannedWorkouts.date}) = ${todayStr}`,
                  eq(plannedWorkouts.activityType, type)
                )
              ).limit(1);

            if (planned.length > 0) {
              await db.update(plannedWorkouts)
                .set({ complianceStatus: 'VALIDATED' })
                .where(eq(plannedWorkouts.id, planned[0].id));
              
              const modalidadeStr = type === 'STRENGTH' ? 'Musculação 🏋️' : 'Bike 🚴';
              await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: messageId,
                  text: `✅ Check-in de ${modalidadeStr} validado!\nExcelente consistência, comandante. O seu radar de condicionamento foi atualizado na matriz.`
                })
              });
            } else {
              await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: messageId,
                  text: `⚠️ Missão não encontrada.\nNão identifiquei prescrição de ${type === 'STRENGTH' ? 'Musculação' : 'Bike'} programada para a data de hoje na planilha tática.`
                })
              });
            }
          }
          }
          return c.text('OK', 200);
        }
      }

      // ======================================================================
      // 2. Processamento de Mensagens de Texto (Comandos Interativos)
      // ======================================================================
      if (update.message && update.message.text) {
        const text = update.message.text.trim() as string;
        const chatId = update.message.chat.id as number;

        const athleteList = await db.select().from(athletes).limit(1);
        const athlete = athleteList.length > 0 ? athleteList[0] : null;

        if (!athlete) return c.text('OK', 200);

        // Comando: /ajuda, /help ou /menu
        if (text === '/ajuda' || text === '/help' || text === '/menu') {
          const menuText = "🛡️ *KINETIX HUB \\- CENTRAL DE COMANDO* 🛡️\n\nSelecione uma operação no painel abaixo ou digite a sua intenção:";
          const keyboard = {
            inline_keyboard: [
              [
                { text: '🎯 Prova Alvo', callback_data: 'cmd_provaalvo' },
                { text: '🗓️ Treino de Hoje', callback_data: 'cmd_hoje' }
              ],
              [
                { text: '📡 Briefing de Amanhã', callback_data: 'cmd_briefing' },
                { text: '🔎 Auditar Strava', callback_data: 'cmd_auditoria' }
              ],
              [
                { text: '⚖️ Peso', callback_data: 'cmd_peso' },
                { text: '🩹 Relatar Dor', callback_data: 'cmd_dor' }
              ]
            ]
          };
          await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: menuText, parse_mode: 'MarkdownV2', reply_markup: keyboard })
          });
          return c.text('OK', 200);
        }

        // Delegação para serviços existentes
        if (text === '/briefing' || text === '/auditoria') {
          await telegramMessageService.processIncomingMessage(chatId, text);
          return c.text('OK', 200);
        }

        // Comando: /hoje
        if (text === '/hoje') {
          const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
          const planned = await db.select()
            .from(plannedWorkouts)
            .where(
              and(
                eq(plannedWorkouts.athleteId, athlete.id),
                sql`DATE(${plannedWorkouts.date}) = ${todayStr}`
              )
            );

          if (planned.length === 0) {
            await telegramMessageService.sendSimpleMessage(
              chatId, 
              '💤 *Dia OFF detectado na matriz.*\nReforce o protocolo de descanso, hidratação e recuperação.'
            );
          } else {
            let msg = `🎯 *Missões de Hoje (${todayStr}):*\n\n`;
            planned.forEach(w => {
              const details = (w.details as Record<string, any>) || {};
              msg += `*Modalidade:* ${w.activityType}\n`;
              if (details.corrida) msg += `🏃 *Corrida:* ${details.corrida}\n`;
              if (details.academia) msg += `🏋️ *Academia:* ${details.academia}\n`;
              if (details.bike) msg += `🚴 *Bike:* ${details.bike}\n`;
              if (details.restDetails) msg += `⏸️ *Repouso:* ${details.restDetails}\n`;
              msg += `*Status:* ${w.complianceStatus || 'PENDING'}\n\n`;
            });
            await telegramMessageService.sendSimpleMessage(chatId, msg);
          }
          return c.text('OK', 200);
        }

        // Comando: /provaalvo
        if (text.startsWith('/provaalvo')) {
          const paramsStr = text.replace('/provaalvo', '').trim();
          if (!paramsStr) {
            const instructions = "🎯 *Registro de Nova Missão*\n\nPara travar a mira na sua próxima prova, digite o comando:\n\n`/provaalvo Nome da Prova | DD/MM/AAAA | Distância`\n\n💡 *Exemplo:* `/provaalvo Nike SP City Marathon | 26/07/2026 | 21km`";
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: instructions, parse_mode: 'MarkdownV2' })
            });
            return c.text('OK', 200);
          }

          const parts = paramsStr.split('|').map(p => p.trim());
          if (parts.length >= 3) {
            const name = parts[0];
            const dateParts = parts[1].split('/');
            const date = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T12:00:00Z`);
            const distance = parseFloat(parts[2].replace(/[^\d.,]/g, '').replace(',', '.'));

            await db.insert(races).values({
              name,
              category: 'P1',
              date,
              distance,
              startTime: '06:00',
              startLocation: 'TBD',
              targetPace: '05:00',
              isTarget: true,
            });
            await telegramMessageService.sendSimpleMessage(chatId, "✅ *Missão Travada!* A prova foi registrada na base de dados. O calendário de treinos será ajustado para este alvo.");
          } else {
            await telegramMessageService.sendSimpleMessage(chatId, "⚠️ Formato inválido. Use: `/provaalvo Nome da Prova | DD/MM/AAAA | Distância`");
          }
          return c.text('OK', 200);
        }

        // Comando: /peso <valor>
        if (text === '/peso') {
          await telegramMessageService.sendSimpleMessage(chatId, "⚖️ Envie o comando `/peso <valor>` para registrar sua bioimpedância.\nExemplo: `/peso 75.5`");
          return c.text('OK', 200);
        }
        const pesoMatch = text.match(/^\/peso\s+([\d.,]+)/);
        if (pesoMatch) {
          const weight = parseFloat(pesoMatch[1].replace(',', '.'));
          await db.insert(bioimpedanceLogs).values({
            athleteId: athlete.id,
            date: new Date(),
            weight: weight,
            bodyFat: 0,
            muscleMass: 0,
            bodyWater: 0,
            visceralFat: 0,
            metabolicAge: 0,
            tmb: 0,
            protein: 0,
            boneMass: 0,
          });
          await telegramMessageService.sendSimpleMessage(chatId, `⚖️ Peso de ${weight}kg registrado com sucesso na matriz biológica.`);
          return c.text('OK', 200);
        }

        // Comando: /dor <nota> <local>
        if (text === '/dor') {
          await telegramMessageService.sendSimpleMessage(chatId, "🩹 Envie o comando `/dor <nota> <local>` para registrar uma dor articular.\nExemplo: `/dor 6 Joelho Direito`");
          return c.text('OK', 200);
        }
        const dorMatch = text.match(/^\/dor\s+(\d+)\s+(.+)/);
        if (dorMatch) {
          const nota = parseInt(dorMatch[1], 10);
          const local = dorMatch[2];
          await db.insert(pendingActions).values({
            id: crypto.randomUUID(),
            athleteId: athlete.id,
            workoutId: crypto.randomUUID(), // Dummy UUID para notificação de Radar
            action: 'CLINICAL_ALERT',
            notes: `Dor articular reportada: ${local} (Nível de Dor: ${nota}/10)`,
            createdAt: new Date(),
          });
          await telegramMessageService.sendSimpleMessage(
            chatId, 
            `⚠️ *Alerta clínico registrado.*\n\nO Head Coach IA foi notificado sobre a dor no(a) *${local}* (Nível ${nota}). A carga metabólica e de impacto poderá ser reduzida automaticamente no próximo micro-ciclo.`
          );
          return c.text('OK', 200);
        }

        // Comando: /checkin
        if (text === '/checkin') {
          const keyboard = {
            inline_keyboard: [
              [
                { text: '🏋️ Musculação', callback_data: 'checkin_STRENGTH' },
                { text: '🚴 Bike', callback_data: 'checkin_BIKE' }
              ]
            ]
          };
          await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: 'Selecione a modalidade isolada para efetuar o check-in manual e confirmar a conclusão:',
              reply_markup: keyboard
            })
          });
          return c.text('OK', 200);
        }
      }

      return c.text('OK', 200);
    } catch (error) {
      console.error('❌ Erro no Telegram Webhook Controller:', error);
      return c.text('Internal Server Error', 500);
    }
  },

  async handleCron(c: Context) {
    return c.json({ success: true, message: 'Cron job executado via chamada de API' });
  },

  async handleRecalculate(c: Context) {
    return c.json({ success: true, message: 'Recálculo executado via chamada de API' });
  }
};