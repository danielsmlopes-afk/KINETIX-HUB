import { db } from '@/db';
import { workoutSessions } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { athleteRepository } from '@/repositories/athleteRepository';

export const acwrService = {
  async calculateWeeklyFatigue() {
    const athlete = await athleteRepository.getPrimaryAthlete();
    if (!athlete) {
      throw new Error("Atleta principal não encontrado.");
    }

    const now = new Date();
    const acuteDate = new Date();
    acuteDate.setDate(now.getDate() - 7); // Últimos 7 dias (Carga Aguda)
    
    const chronicDate = new Date();
    chronicDate.setDate(now.getDate() - 28); // Últimos 28 dias (Carga Crônica)

    const sessions = await db.select({
      date: workoutSessions.date,
      load: workoutSessions.load
    })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.athleteId, athlete.id), gte(workoutSessions.date, chronicDate)));

    let acuteLoad = 0;
    let chronicLoadTotal = 0;

    for (const session of sessions) {
      const load = session.load || 0;
      chronicLoadTotal += load;
      
      if (session.date >= acuteDate) {
        acuteLoad += load;
      }
    }

    // Carga Crônica é a média semanal das últimas 4 semanas
    const chronicLoad = chronicLoadTotal / 4;
    const acwr = chronicLoad > 0 ? (acuteLoad / chronicLoad) : 0;
    const roundedAcwr = Math.round(acwr * 100) / 100;

    let status = 'ZONA_IDEAL';
    let suggestion = 'Carga de treinamento equilibrada. Mantenha o planejamento.';

    if (roundedAcwr < 0.8) {
      status = 'UNDERTRAINING';
      suggestion = 'Risco de destreinamento. Considere aumentar o volume gradativamente.';
    } else if (roundedAcwr > 1.3 && roundedAcwr <= 1.5) {
      status = 'ZONA_DE_ALERTA';
      suggestion = 'Carga elevada. Monitore sinais de fadiga e priorize a recuperação e sono.';
    } else if (roundedAcwr > 1.5) {
      status = 'ZONA_DE_PERIGO';
      suggestion = 'Risco alto de lesão! Redução imediata de 20% a 30% no volume sugerida para a próxima semana.';
    }

    return {
      acwr: roundedAcwr,
      acuteLoad: Math.round(acuteLoad),
      chronicLoad: Math.round(chronicLoad),
      status,
      suggestion
    };
  }
};