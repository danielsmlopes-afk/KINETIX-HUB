import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { env } from '../config/env';

// Cria a conexão HTTP com o Neon DB
const sql = neon(env.DATABASE_URL);

// Exporta a instância do banco atrelada ao seu schema
export const db = drizzle(sql, { schema });
