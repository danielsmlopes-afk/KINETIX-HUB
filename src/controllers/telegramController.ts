import { Context } from 'hono';

export const telegramController = {
  async handleWebhook(c: Context) {
    try {
      const body = await c.req.json();
      
      if (body.message?.text) {
        const text = body.message.text as string;
        const bioRegex = /peso\s*(\d+[.,]?\d*).*gordura\s*(\d+[.,]?\d*).*tmb\s*(\d+)/i;
        const match = text.match(bioRegex);

        if (match) {
          const [, weight, fat, bmr] = match;
          console.log(`📡 Telemetria: Peso=${weight}kg, BF=${fat}%, TMB=${bmr}kcal`);
          return c.json({ data: { message: "Bioimpedância registrada com sucesso." } });
        }
      }
      return c.json({ data: { message: "Comando ignorado ou não reconhecido." } });
    } catch (error) {
      return c.json({ error: "Erro interno no processamento do webhook.", code: "WEBHOOK_ERR" }, 400);
    }
  }
};