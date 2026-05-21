import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'src/config/.env') });

if (!process.env.DATABASE_URL) {
  throw new Error("⚠️ ERRO FATAL: DATABASE_URL não foi encontrada no arquivo .env");
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!, // <-- A MÁGICA ESTÁ AQUI
  },
  verbose: true,
  strict: true,
});