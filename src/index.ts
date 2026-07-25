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

// Tratador Global de Erros para interceptar UUIDs inválidos e evitar crash
app.onError((err, c) => {
  if (err.name === 'DrizzleValidationError') {
    return c.json({
      error: 'Formato de identificador (UUID) inválido na requisição.',
      details: err.message
    }, 400);
  }
  console.error('💥 Erro não tratado:', err);
  return c.json({ error: 'Erro Interno do Servidor', code: 'INTERNAL_ERROR' }, 500);
});

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
