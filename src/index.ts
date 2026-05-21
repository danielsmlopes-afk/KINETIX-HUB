import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { env } from '@/config/env';
import { telegramController } from '@/controllers/telegramController';
import { initCronJobs } from '@/services/cronJobs';

const app = new Hono();

app.get('/', (c) => {
  return c.json({ data: { status: "KINETIX HUB API OPERACIONAL 🚀" } });
});

app.post('/webhook/telegram', telegramController.handleWebhook);

// Inicializa os disparos automáticos via node-cron (Briefings Logísticos)
initCronJobs();

const port = Number(env.PORT);

console.log(`🚀 KINETIX HUB rodando na porta ${port}...`);
serve({
  fetch: app.fetch,
  port
});