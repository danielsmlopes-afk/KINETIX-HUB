import { runDailyBriefingJob } from '../services/cronJobs';

async function run() {
  console.log('🚀 Disparando o Head Coach IA para o Briefing Diário (Simulação)...');
  
  await runDailyBriefingJob();
  
  console.log('✅ Finalizado! Verifique seu Telegram.');
  process.exit(0);
}

run().catch(console.error);