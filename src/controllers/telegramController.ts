// Arquivo: src/controllers/telegramController.ts
import { Context } from 'hono';
import { runRouteRecalculationJob } from '@/services/cronJobs';
import { briefingService } from '@/services/briefingService';
import { env } from '@/config/env';
import { telegramMessageService } from '@/services/telegramMessageService';

interface TelegramWebhookPayload {
  message?: {
    chat?: { id?: number };
    text?: string;
  };
}

export const telegramController = {
  async handleWebhook(c: Context) {
    try {
      const body = await c.req.json<TelegramWebhookPayload>().catch(() => ({} as TelegramWebhookPayload));

      if (body.message?.text && body.message.chat?.id) {
        const text = body.message.text.trim();
        const chatId = body.message.chat.id;

        // Orquestra a resposta de forma assíncrona (Desacoplamento)
        telegramMessageService.processIncomingMessage(chatId, text).catch(err => {
          console.error('❌ Erro no processamento assíncrono do Telegram:', err);
        });
      }

      // Retorno INCONDICIONAL imediato para o Telegram evitar loop de retentativas
      return c.text('OK', 200);
    } catch (error) {
      console.error('❌ Erro Fatal no Webhook do Telegram:', error);
      return c.text('OK', 200);
    }
  },

  async handleCron(c: Context) {
    try {
      const authHeader = c.req.header('Authorization') || c.req.header('x-cron-secret');
      
      if (authHeader !== env.CRON_SECRET) {
        return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
      }

      // Aciona o Head Coach IA para gerar a narrativa
      const briefingMessage = await briefingService.generateDailyBriefing();
      
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: briefingMessage, parse_mode: 'Markdown' })
      });

      return c.json({ data: { message: "Cron executado e briefing enviado ao Telegram." } });
    } catch (error) {
      return c.json({ error: "Erro interno no processamento do cron.", code: "CRON_ERR" }, 500);
    }
  },

  async handleRecalculate(c: Context) {
    try {
      const authHeader = c.req.header('Authorization') || c.req.header('x-cron-secret');
      
      if (authHeader !== env.CRON_SECRET) {
        return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
      }

      await runRouteRecalculationJob();
      return c.json({ data: { message: "Cron de Recálculo executado com sucesso." } });
    } catch (error) {
      return c.json({ error: "Erro interno ao executar o recálculo.", code: "CRON_ERR" }, 500);
    }
  }
};