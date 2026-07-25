import { db } from '@/db';
import { races } from '@/db/schema';
import { between } from 'drizzle-orm';
import { env } from '@/config/env';
import { athleteRepository } from '@/repositories/athleteRepository';

interface OpenWeatherForecast {
  list?: Array<{
    dt_txt: string;
    main: { temp: number };
  }>;
}

export const weatherPacingService = {
  async checkUpcomingRaces() {
    const athlete = await athleteRepository.getPrimaryAthlete();
    if (!athlete) throw new Error('Atleta principal não encontrado.');

    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    // Busca provas agendadas nos próximos 7 dias
    const upcomingRaces = await db.select().from(races).where(
      between(races.date, today, nextWeek)
    );

    let alertsSent = 0;

    for (const race of upcomingRaces) {
      if (!race.startLocation) continue;

      let tempAtStart = 20; // Temperatura default assumida

      if (env.OPENWEATHER_API_KEY) {
        const url = `http://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(race.startLocation)}&units=metric&lang=pt_br&appid=${env.OPENWEATHER_API_KEY}`;
        try {
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json() as OpenWeatherForecast;
            const raceDateStr = race.date.toISOString().split('T')[0];
            const forecast = data.list?.find(item => item.dt_txt.includes(raceDateStr)) || data.list?.[0];
            
            if (forecast) tempAtStart = forecast.main.temp;
          }
        } catch (e) { console.error('❌ Erro ao buscar clima no Weather-Pacing', e); }
      }

      // Se a temperatura prevista for maior que 22 graus, dispara o alerta estratégico de Pacing
      if (tempAtStart > 22) {
        const message = `⚠️ *ALERTA DE CLIMA E PACING* ⚠️\n\nSua prova *${race.name}* está chegando (${race.date.toLocaleDateString('pt-BR')}).\nA previsão indica temperatura de *${Math.round(tempAtStart)}°C* na largada.\n\n🔥 *Estratégia:* O calor aumenta a frequência cardíaca e o desgaste sistêmico. Considere ajustar seu Smart Pace para 5 a 10s mais lento por km no primeiro terço da prova para evitar a quebra precoce. Reforce a hidratação!`;
        const tUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(tUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' }) });
        alertsSent++;
      }
    }

    return { processed: true, racesChecked: upcomingRaces.length, alertsSent, message: alertsSent > 0 ? 'Alertas de Smart Pace enviados.' : 'Nenhuma prova em condição de risco climático.' };
  }
};
