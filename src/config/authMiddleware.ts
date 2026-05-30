import { Context, Next } from 'hono';
import { firebaseAdmin } from '@/config/firebase';

export const firebaseAuthMiddleware = async (c: Context, next: Next) => {
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
    c.set('user', decodedToken); // Injeta os dados validados do usuário no contexto
    await next();
  } catch (error) {
    console.error('❌ Erro na validação do Firebase Auth:', error instanceof Error ? error.message : error);
    return c.json({ error: 'Acesso negado. Token inválido ou expirado.', code: 'UNAUTHORIZED' }, 401);
  }
};