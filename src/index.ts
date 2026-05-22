import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { apiRoutes } from './routes/api'; // Puxa as suas rotas geradas
import { startCronJobs } from './services/cronJobs';

const app = new Hono();

// Middlewares essenciais
app.use('*', logger());
app.use('*', cors());

// Rota de Health Check (Teste de vida)
app.get('/health', (c) => {
  return c.json({ 
    status: "KINETIX HUB ONLINE", 
    timestamp: new Date().toISOString() 
  });
});

// Montagem das rotas da API
app.route('/api', apiRoutes);

// Configuração da porta
const port = Number(process.env.PORT) || 3000;
console.log(`🚀 Servidor KINETIX HUB rodando na porta ${port}`);
console.log(`👉 Teste de vida: http://localhost:${port}/health`);

// Inicializa as rotinas de segundo plano (Cron Jobs)
startCronJobs();

// Inicia o servidor
serve({
  fetch: app.fetch,
  port
});