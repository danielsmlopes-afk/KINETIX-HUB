import { Context, Next } from 'hono';
import { firebaseAdmin } from '@/config/firebase';
import { athleteRepository } from '@/repositories/athleteRepository';
import { redisClient } from '@/config/redis';
import { env } from '@/config/env';

// Fallback em memória caso o Redis não esteja disponível na env
let localAthleteId: string | null = null;
let localCacheExpiration = 0;

export const firebaseAuthMiddleware = async (c: Context, next: Next) => {
  // DX: Permite bypass de autenticação em ambiente local (desenvolvimento) para facilitar testes
  if (env.BYPASS_AUTH_LOCAL === 'true') {
    let athleteId = localAthleteId;
    if (!athleteId) {
      const athlete = await athleteRepository.getPrimaryAthlete();
      if (athlete) {
        athleteId = athlete.id;
        localAthleteId = athleteId;
      }
    }
    c.set('user', {
      uid: 'bypass-local-user-uid',
      email: 'bypass-local@kinetix-hub.com',
      id: athleteId
    });
    return await next();
  }

  const authHeader = c.req.header('Authorization');
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    const queryToken = c.req.query('token');
    if (queryToken) {
      token = queryToken;
    }
  }

  if (!token) {
    return c.json(
      { error: 'Acesso negado. Token não fornecido ou mal formatado.', code: 'UNAUTHORIZED' },
      401
    );
  }

  try {
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    
    // Otimização: Cache Distribuído no Redis (TTL de 15 min) para o ID Single-Tenant
    let athleteId: string | null = null;
    
    if (redisClient) {
      athleteId = await redisClient.get('primary_athlete_id');
    } else {
      const now = Date.now();
      if (localAthleteId && now <= localCacheExpiration) athleteId = localAthleteId;
    }

    if (!athleteId) {
      const athlete = await athleteRepository.getPrimaryAthlete();
      if (athlete) {
        athleteId = athlete.id;
        if (redisClient) {
          await redisClient.set('primary_athlete_id', athleteId, 'EX', 15 * 60);
        } else {
          localAthleteId = athleteId;
          localCacheExpiration = Date.now() + 15 * 60 * 1000;
        }
      }
    }
    
    // Injeta os dados validados do usuário no contexto, garantindo que 'user.id'
    // contenha um UUID válido e não a string do Firebase (user.uid).
    // Isso previne o erro NeonDbError: invalid input syntax for type uuid
    c.set('user', { ...decodedToken, id: athleteId });
    
    await next();
  } catch (error) {
    console.error('❌ Erro na validação do Firebase Auth:', error instanceof Error ? error.message : error);
    return c.json({ error: 'Acesso negado. Token inválido ou expirado.', code: 'UNAUTHORIZED' }, 401);
  }
};