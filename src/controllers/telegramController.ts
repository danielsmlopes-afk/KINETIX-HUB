import { Context } from 'hono';
import { db } from '@/db';
import { athletes, plannedWorkouts, bioimpedanceLogs, pendingActions } from '@/db/schema';
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
        const callbackData = update.callback_query.data;
        const chatId = update.callback_query.message.chat.id;
        const messageId = update.callback_query.message.message_id;

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
              // @ts-ignore
              await (telegramMessageService as any).editMessageText(
                chatId, 
                messageId, 
                `✅ Check-in de ${modalidadeStr} validado!\nExcelente consistência, comandante. O seu radar de condicionamento foi atualizado na matriz.`
              );
            } else {
              // @ts-ignore
              await (telegramMessageService as any).editMessageText(
                chatId, 
                messageId, 
                `⚠️ Missão não encontrada.\nNão identifiquei prescrição de ${type === 'STRENGTH' ? 'Musculação' : 'Bike'} programada para a data de hoje na planilha tática.`
              );
            }
          }
        }
        return c.text('OK', 200);
      }

      // ======================================================================
      // 2. Processamento de Mensagens de Texto (Comandos Interativos)
      // ======================================================================
      if (update.message && update.message.text) {
        const text = update.message.text.trim();
        const chatId = update.message.chat.id;

        const athleteList = await db.select().from(athletes).limit(1);
        const athlete = athleteList.length > 0 ? athleteList[0] : null;

        if (!athlete) return c.text('OK', 200);

        // Comando: /ajuda ou /help
        if (text === '/ajuda' || text === '/help') {
          const helpText = `*Comandos Operacionais - KINETIX HUB:*\n\n` +
            `/hoje - Visualizar a planilha tática do dia\n` +
            `/checkin - Validar manualmente treino de Força ou Bike\n` +
            `/peso <valor> - Registrar peso (kg) na bioimpedância\n` +
            `/dor <nota> <local> - Registrar dor articular (nota de 1 a 10)\n`;
          await telegramMessageService.sendSimpleMessage(chatId, helpText);
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

        // Comando: /peso <valor>
        const pesoMatch = text.match(/^\/peso\s+([\d.,]+)/);
        if (pesoMatch) {
          const weight = parseFloat(pesoMatch[1].replace(',', '.'));
          await db.insert(bioimpedanceLogs).values({
            id: crypto.randomUUID(),
            athleteId: athlete.id,
            date: new Date(),
            weight: weight,
          } as any);
          await telegramMessageService.sendSimpleMessage(chatId, `⚖️ Peso de ${weight}kg registrado com sucesso na matriz biológica.`);
          return c.text('OK', 200);
        }

        // Comando: /dor <nota> <local>
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
          } as any);
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
          // @ts-ignore
          await (telegramMessageService as any).sendMessage(
            chatId, 
            'Selecione a modalidade isolada para efetuar o check-in manual e confirmar a conclusão:', 
            { reply_markup: JSON.stringify(keyboard) }
          );
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