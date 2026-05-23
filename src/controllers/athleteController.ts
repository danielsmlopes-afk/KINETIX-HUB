// Arquivo: src/controllers/athleteController.ts
import { Context } from 'hono';
import { db } from '@/db';
import { athletes, bioimpedanceLogs, races, plannedWorkouts } from '@/db/schema';
import { eq, desc, gte } from 'drizzle-orm';

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
      const upcomingRacesDb = await db.select()
        .from(races)
        .where(gte(races.date, new Date())) // Filtrando do dia atual em diante
        .orderBy(races.date)
        .limit(3);

      const upcomingRaces = upcomingRacesDb.map(r => ({
        name: r.name || r.category,
        date: new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
        distance: `${r.distance} km`
      }));

      // 4. Busca os Próximos Treinos Planejados do Macrociclo
      const upcomingWorkoutsDb = await db.select()
        .from(plannedWorkouts)
        .where(eq(plannedWorkouts.athleteId, athlete.id))
        .orderBy(desc(plannedWorkouts.date))
        .limit(5);

      const upcomingWorkouts = upcomingWorkoutsDb.reverse().map(w => {
        // Garantia de fallback para o campo JSONB
        const details = (w.details as Record<string, any>) || {};
        return {
          id: w.id,
          date: new Date(w.date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }),
          activityType: w.activityType,
          title: w.title,
          subtitle: details.subtitle || 'Treino Estruturado'
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
