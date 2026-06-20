import { db } from '@/db';
import { workoutSessions, plannedWorkouts } from '@/db/schema';
import { eq, and, gte, sql, asc } from 'drizzle-orm';
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
      load: workoutSessions.load,
      complianceStatus: plannedWorkouts.complianceStatus,
      complianceFeedback: plannedWorkouts.complianceFeedback
    })
    .from(workoutSessions)
    .leftJoin(
      plannedWorkouts,
      and(
        eq(workoutSessions.athleteId, plannedWorkouts.athleteId),
        eq(sql`DATE(${workoutSessions.date})`, sql`DATE(${plannedWorkouts.date})`)
      )
    )
    .where(and(eq(workoutSessions.athleteId, athlete.id), gte(workoutSessions.date, chronicDate)));

    let acuteLoad = 0;
    let chronicLoadTotal = 0;

    for (const session of sessions) {
      let load = session.load || 0;

      // Fatoramento tático de fadiga com base no desvio de compliance
      if (session.complianceStatus === 'COMPLETED_NOT_VALIDATED' || session.complianceStatus === 'PARTIAL') {
        const feedback = (session.complianceFeedback || '').toLowerCase();
        if (feedback.includes('forte demais') || feedback.includes('fadiga')) {
          // Penalidade por excesso de intensidade: estresse cardiovascular/articular aumentado
          load *= 1.3;
        } else if (feedback.includes('lento demais')) {
          // Compensação por intensidade reduzida: estresse inferior ao planejado
          load *= 0.8;
        } else {
          // Desvio genérico (ex: volume)
          load *= 1.1;
        }
      }

      chronicLoadTotal += load;
      
      if (session.date >= acuteDate) {
        acuteLoad += load;
      }
    }

    // Descobre a data do primeiro treino registrado do atleta no sistema
    const firstSession = await db.select({ date: workoutSessions.date })
      .from(workoutSessions)
      .where(eq(workoutSessions.athleteId, athlete.id))
      .orderBy(asc(workoutSessions.date))
      .limit(1);

    let divisorWeeks = 4;
    if (firstSession.length > 0) {
      const daysActive = Math.ceil((now.getTime() - new Date(firstSession[0].date).getTime()) / (1000 * 60 * 60 * 24));
      divisorWeeks = Math.max(1, Math.min(4, daysActive / 7));
    }

    // Carga Crônica é a média semanal das últimas 4 semanas
    const chronicLoad = chronicLoadTotal / divisorWeeks;
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