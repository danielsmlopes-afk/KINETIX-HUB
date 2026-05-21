import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'src/config/.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.string().default('3000'),
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_CHAT_ID: z.string(),
  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),
  OPENWEATHER_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas ou ausentes:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;