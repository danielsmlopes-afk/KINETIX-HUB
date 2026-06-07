import { Redis } from 'ioredis';
import { env } from '@/config/env';

// Inicializa a conexão com o Redis apenas se a variável existir
export const redisClient = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;

if (redisClient) {
  redisClient.on('connect', () => console.log('📦 Redis distribuído conectado com sucesso.'));
  redisClient.on('error', (err) => console.error('❌ Erro na conexão do Redis:', err));
}
