import { db } from '@/db';
import { races } from '@/db/schema';

async function clear() {
  console.log('🗑️ Apagando todas as provas do banco de dados...');
  await db.delete(races);
  console.log('✅ Todas as provas foram apagadas com sucesso!');
  process.exit(0);
}

clear().catch(console.error);
