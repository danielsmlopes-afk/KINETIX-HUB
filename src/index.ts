import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { apiRoutes } from './routes/api'; // Puxa as suas rotas geradas
import { debugRoutes } from './routes/debugRoutes';
import { strengthRoutes } from './routes/strengthRoutes';
import { reportRoutes } from './routes/reportRoutes';
import { dossierRoutes } from './routes/dossierRoutes';
import { startCronJobs } from './services/cronJobs';

const app = new Hono();

// Middlewares essenciais
app.use('*', logger());
app.use('*', cors());

// Rota raiz para evitar erro 404 (Render/Pings)
app.get('/', (c) => {
  return c.text('KINETIX HUB API IS RUNNING', 200);
});

// Silencia requisições de favicon do navegador
app.get('/favicon.ico', (c) => {
  return c.body(null, 204);
});

// Rota de Health Check (Teste de vida)
app.get('/health', (c) => {
  return c.json({ 
    status: "KINETIX HUB ONLINE", 
    timestamp: new Date().toISOString() 
  });
});

// Rota de Health Check exigida pelo Render
app.get('/api/healthz', (c) => {
  return c.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  }, 200);
});

// Montagem das rotas da API
app.route('/api', apiRoutes);
app.route('/api/debug', debugRoutes);
app.route('/api/strength', strengthRoutes);
app.route('/api/reports', reportRoutes);
app.route('/api/dossiers', dossierRoutes);

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