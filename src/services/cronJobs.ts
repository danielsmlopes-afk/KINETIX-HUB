import cron from 'node-cron';
import { generateDailyBriefing } from './briefingService';
import { env } from '@/config/env';

export function initCronJobs() {
  // Disparo diário às 22h00
  cron.schedule('0 22 * * *', async () => {
    const briefing = generateDailyBriefing('Z2 Endurance 12km', '22°C, Céu limpo');
    
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: briefing, parse_mode: 'Markdown' })
    });
    console.log('✅ Cron: Briefing diário enviado.');
  });
}