// Arquivo: src/controllers/athleteController.ts
import { Context } from 'hono';
import { db } from '@/db';
import { athletes, bioimpedanceLogs, races, plannedWorkouts } from '@/db/schema';
import { eq, desc, gte, and, asc } from 'drizzle-orm';

export const athleteController = {
  async getProfile(c: Context) {
    try {
      // 1. Identifica o Atleta Principal do Sistema (Single-Tenant)
      const athleteList = await db.select().from(athletes).limit(1);
      if (athleteList.length === 0) {
        return c.json({ error: 'Atleta principal não encontrado no sistema.', code: 'NOT_FOUND' }, 404);
      }
      const athlete = athleteList[0];

      // 2. Busca a Última Bioimpedância Registrada
      const bioList = await db.select()
        .from(bioimpedanceLogs)
        .where(eq(bioimpedanceLogs.athleteId, athlete.id))
        .orderBy(desc(bioimpedanceLogs.date))
        .limit(1);

      const latestBio = bioList.length > 0 ? {
        weight: bioList[0].weight,
        muscleMass: bioList[0].muscleMass,
        fatPercentage: bioList[0].bodyFat // Mapeamento DB -> Contrato Mobile
      } : undefined;

      // 3. Busca Próximas Provas Alvo
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcomingRacesDb = await db.select()
        .from(races)
        .where(gte(races.date, today)) // Filtrando do dia atual em diante
        .orderBy(asc(races.date))
        .limit(3);

      const upcomingRaces = upcomingRacesDb.map(r => ({
        name: r.name || r.category,
        date: new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
        distance: `${r.distance} km`
      }));

      // 4. Busca os Próximos Treinos Planejados do Macrociclo
      const upcomingWorkoutsDb = await db.select()
        .from(plannedWorkouts)
        .where(
          and(
            eq(plannedWorkouts.athleteId, athlete.id),
            gte(plannedWorkouts.date, today)
          )
        )
        .orderBy(asc(plannedWorkouts.date))
        .limit(5);

      // 5. Integração Tática com OpenWeatherMap para o Clima (Previsão de 5 dias)
      let weatherForecasts: any[] = [];
      const apiKey = process.env.OPENWEATHER_API_KEY;
      if (apiKey) {
        try {
          const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=Sao%20Paulo,BR&units=metric&lang=pt_br&appid=${apiKey}`);
          if (res.ok) {
            const data = await res.json();
            weatherForecasts = data.list || [];
          }
        } catch (e) {
          console.error('❌ Erro ao buscar clima no OpenWeatherMap:', e);
        }
      }

      const upcomingWorkouts = upcomingWorkoutsDb.map(w => {
        // Garantia de fallback para o campo JSONB
        const details = (w.details as Record<string, any>) || {};
        const workoutDate = new Date(w.date);
        
        let weatherStr = '🌤️ Clima: Aguardando telemetria...';
        if (apiKey && weatherForecasts.length > 0) {
          const dateString = workoutDate.toISOString().split('T')[0];
          // Procura previsão para às 12:00:00 daquele dia (ou a mais próxima)
          const targetTime = `${dateString} 12:00:00`;
          let forecast = weatherForecasts.find((f: any) => f.dt_txt === targetTime);
          if (!forecast) { forecast = weatherForecasts.find((f: any) => f.dt_txt?.startsWith(dateString)); }

          if (forecast) {
            weatherStr = `🌤️ ${forecast.weather[0].description}, ${Math.round(forecast.main.temp)}°C`;
          } else {
            weatherStr = '🌤️ Clima: Previsão estendida não disponível para o dia';
          }
        }

        return {
          id: w.id,
          date: workoutDate.toISOString().split('T')[0], // YYYY-MM-DD para o app processar
          activityType: w.activityType,
          title: w.title,
          subtitle: details.subtitle || 'Treino Estruturado',
          weather: weatherStr
        };
      });

      // Empacota tudo para o Payload consolidado do Dashboard Mobile
      const profile = { name: athlete.name, latestBioimpedance: latestBio, upcomingRaces, upcomingWorkouts };
      return c.json({ data: profile }, 200);
    } catch (error) {
      console.error('❌ Erro ao buscar perfil do atleta:', error);
      return c.json(
        { error: 'Erro interno ao buscar perfil do atleta.', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
};
