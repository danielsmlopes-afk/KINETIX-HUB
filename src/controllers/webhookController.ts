import { Context } from 'hono';
import { toggleMonitor } from '@/services/uptimeService';

export const webhookController = {
  toggleUptime: async (c: Context) => {
    // 1. Verificação de Segurança (A senha que configuramos)
    const secret = c.req.header('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) {
      return c.json({ error: 'Unauthorized', code: 'AUTH_FAILED' }, 401);
    }

    try {
      // 2. Extração do payload (0 ou 1)
      const body = await c.req.json();
      const status = body.status;

      if (status !== 0 && status !== 1) {
        return c.json({ error: 'Status inválido. Use 0 ou 1.', code: 'BAD_REQUEST' }, 400);
      }

      // 3. Execução da ação
      await toggleMonitor(status);
      return c.json({ data: { message: `Comando enviado para status ${status}` } }, 200);

    } catch (error) {
      return c.json({ error: 'Erro ao processar webhook', code: 'INTERNAL_ERROR' }, 500);
    }
  }
};
