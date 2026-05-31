import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'src/config/.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.string().default('3000'),
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_CHAT_ID: z.string(),
  TELEGRAM_CRON_SECRET: z.string(),
  CRON_SECRET: z.string(),
  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),
  STRAVA_REDIRECT_URI: z.string().optional(),
  STRAVA_VERIFY_TOKEN: z.string().optional(),
  STRAVA_ACCESS_TOKEN: z.string().optional(),
  STRAVA_REFRESH_TOKEN: z.string().optional(),
  STRAVA_EXPIRES_AT: z.string().optional(),
  OPENWEATHER_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  MAPS_API_KEY: z.string().optional(),
  MAPS_BASE_URL: z.string().optional(),
  MAPSTATIC_URL: z.string().optional(),
  UPTIMEROBOT_API_KEY: z.string().min(1),
  UPTIMEROBOT_MONITOR_ID: z.string().min(1),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  REDIS_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas ou ausentes:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;