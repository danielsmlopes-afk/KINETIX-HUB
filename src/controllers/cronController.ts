import { Context } from 'hono';

export const cronController = {
  async runDailyBriefing(c: Context) {
    // 1. Auditoria Forense do Cron (Fuso horário do Servidor/UTC)
    console.log('Endpoint atingido às:', new Date().toISOString());

    try {
      // A Lógica do Briefing e injeção do motor Pré-Prova vai aqui...
      const message = "Briefing KINETIX HUB: Status Operacional Verificado.";
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) return c.json({ error: 'Configuração do Telegram ausente.' }, 500);

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message })
      });

      if (!response.ok) throw { response: { data: await response.json() } };
      return c.json({ success: true, message: 'Briefing diário enviado com sucesso.' });
    } catch (error: unknown) {
      // 2. Try/Catch bloqueando e auditando a falha no Telegram sem quebrar o servidor
      const err = error as { response?: { data?: unknown }, message?: string };
      console.error('Falha no Telegram:', err.response?.data || err.message);
      return c.json({ error: 'Falha interna ao acionar bot de Telegram' }, 500);
    }
  }
};
