import { db } from '@/db';
import { athletes, plannedWorkouts } from '@/db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';

export const briefingService = {
  /**
   * Gera o Briefing Diário cruzando a agenda de treinos de amanhã com a previsão do clima.
   */
  async generateDailyBriefing(): Promise<string> {
    try {
      // 1. Identifica o Atleta Principal
      const athleteList = await db.select().from(athletes).limit(1);
      if (athleteList.length === 0) return 'Atleta principal não encontrado no sistema.';
      const athlete = athleteList[0];

      // 2. Prepara o range de datas para o dia de amanhã
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      // 3. Busca o treino planejado para amanhã (Fase 5.2 - Planilha de Treinos)
      const workouts = await db.select()
        .from(plannedWorkouts)
        .where(
          and(
            eq(plannedWorkouts.athleteId, athlete.id),
            gte(plannedWorkouts.date, tomorrow),
            lt(plannedWorkouts.date, dayAfter)
          )
        );
      
      const workout = workouts.length > 0 ? workouts[0] : null;

      // 4. Integração OpenWeatherMap (Previsão preditiva)
      let weatherInfo = '🌡️ Clima: Previsão Indisponível (Sem chave de API configurada)';
      const apiKey = process.env.OPENWEATHER_API_KEY;
      
      if (apiKey) {
        // Você pode parametrizar a cidade posteriormente na tabela de atletas
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Sao%20Paulo,BR&units=metric&lang=pt_br&appid=${apiKey}`);
        if (res.ok) {
          const data = await res.json() as any;
          weatherInfo = `🌡️ Clima previsto: ${data.weather[0].description}, ${Math.round(data.main.temp)}°C`;
        }
      }

      // 5. Estrutura a narrativa da IA para o Telegram
      let briefing = `🤖 *KINETIX HUB - BRIEFING DIÁRIO*\n\n`;
      briefing += `🗓️ *Data:* ${tomorrow.toLocaleDateString('pt-BR')}\n`;
      briefing += `${weatherInfo}\n\n`;

      if (workout) {
        const details = (workout.details as Record<string, any>) || {};
        
        // Inteligência Logística: Estimar Duração e Géis
        let gelAdvice = `- Planejar nutrição intra-treino conforme o cronograma.\n`;
        const subtitle = String(details.subtitle || '');
        const distMatch = subtitle.match(/(\d+(?:[.,]\d+)?)\s*km/i);
        let durationMins = 0;

        if (distMatch) {
          const dist = parseFloat(distMatch[1].replace(',', '.'));
          const speedMatch = subtitle.match(/(\d+(?:[.,]\d+)?)\s*km\/h/i);
          const paceMatch = subtitle.match(/(\d{1,2}):(\d{2})/);

          if (speedMatch) {
            const speed = parseFloat(speedMatch[1].replace(',', '.'));
            if (speed > 0) durationMins = (dist / speed) * 60;
          } else if (paceMatch) {
            const mins = parseInt(paceMatch[1], 10);
            const secs = parseInt(paceMatch[2], 10);
            durationMins = dist * (mins + (secs / 60));
          }
        }

        if (durationMins >= 60) {
          let gels = 1;
          const remaining = durationMins - 60;
          if (remaining >= 30) gels += Math.floor(remaining / 30);
          gels += 1; // 1 de Segurança/Reserva
          gelAdvice = `- Levar ${gels}x Géis de Carboidrato (Tome 1 aos 45-60min, e depois a cada 30-45min. 1 é extra/reserva).\n`;
        }

        briefing += `🏃 *MISSÃO DE AMANHÃ:*\n`;
        briefing += `🔸 *Modalidade:* ${workout.activityType}\n`;
        briefing += `🔸 *Foco:* ${workout.title}\n`;
        if (details.subtitle) briefing += `🔸 *Série:* ${details.subtitle}\n\n`;
        
        briefing += `🎒 *CHECKLIST LOGÍSTICO:*\n`;
        if (workout.activityType === 'RUN' || workout.activityType === 'BIKE') {
          briefing += `- Equipamento esportivo e GPS na carga.\n`;
          briefing += gelAdvice;
        } else {
          briefing += `- Fichas preparadas. Prevenção e hipertrofia no Lab.\n`;
        }
      } else {
        briefing += `🧘 *MISSÃO DE AMANHÃ:*\n`;
        briefing += `REST DAY - Foco total em recuperação e mobilidade.\n`;
      }

      return briefing;
    } catch (error) {
      console.error('❌ Erro na geração do Briefing Diário:', error);
      return 'Falha na geração do briefing operacional.';
    }
  }
};