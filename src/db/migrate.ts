import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { env } from '../config/env';

const sql = neon(env.DATABASE_URL);
const db = drizzle(sql);

async function runMigrations() {
  console.log('⏳ Rodando migrations...');
  // A pasta "drizzle" é o output padrão das suas migrations configurada no drizzle.config.ts
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('✅ Migrations aplicadas com sucesso!');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('❌ Erro nas migrations:', err);
  process.exit(1);
});