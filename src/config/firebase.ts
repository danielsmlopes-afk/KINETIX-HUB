import * as admin from 'firebase-admin';
import { env } from '@/config/env';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      // O replace garante que as quebras de linha da chave privada sejam lidas corretamente pelo Node
      privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
  console.log('🔥 Firebase Admin inicializado com sucesso.');
}

export const firebaseAdmin = admin;
