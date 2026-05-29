import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { plannedWorkouts } from '@/db/schema';
import { StravaActivity } from '@/services/stravaService';

/**
 * Utilitário: Converte pace formatado (ex: "07:10") para segundos totais.
 */
function parsePaceToSeconds(paceStr: string): number {
  if (!paceStr) return 0;
  const match = paceStr.match(/(\d+):(\d{2})/);
  if (match) {
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }
  return 0;
}

export const coachService = {
  /**
   * Auditoria Pós-Treino via Strava (Protocolo Esteira Calibrada V2)
   * Avalia a distância universal e adapta a malha de Pace perante o cenário Indoor vs Outdoor.
   */
  async auditWorkout(
    activity: StravaActivity,
    plannedWorkoutId: string,
    targetDistanceKm: number,
    targetPaceStr: string
  ) {
    let complianceStatus = 'VALIDATED';
    let feedback = '';

    const isIndoor = activity.trainer === true || 
                     activity.type === 'VirtualRun' || 
                     activity.type === 'IndoorRun';
                     
    const actualDistanceKm = activity.distance / 1000;
    const actualPaceSeconds = actualDistanceKm > 0 ? (activity.moving_time / actualDistanceKm) : 0;

    // 1. REGRA DE DISTÂNCIA UNIVERSAL (RUA E ESTEIRA)
    const minDistanceAllowed = targetDistanceKm * 0.95; // Queda tolerável máxima de 5%
    if (actualDistanceKm < minDistanceAllowed) {
      complianceStatus = 'PARTIAL';
      feedback = `Distância abaixo da meta. Realizou ${actualDistanceKm.toFixed(2)}km de ${targetDistanceKm}km.`;
    }

    // 2. REGRA DE PACE (RUA VS ESTEIRA)
    const targetPaceSeconds = parsePaceToSeconds(targetPaceStr);

    if (isIndoor) {
      // CENÁRIO B: Esteira / Indoor
      if (complianceStatus === 'VALIDATED') {
        feedback = "Atividade Indoor Detectada: Distância calibrada aceita. Auditoria estrita de Pace suspensa devido à dinâmica da esteira.";
      }
    } else {
      // CENÁRIO A: Rua / Outdoor
      if (complianceStatus === 'VALIDATED' && targetPaceSeconds > 0) {
        const lowerBound = targetPaceSeconds - 10;
        const upperBound = targetPaceSeconds + 10;

        if (actualPaceSeconds < lowerBound) {
          complianceStatus = 'PARTIAL';
          feedback = "Ritmo forte demais. Risco de fadiga residual.";
        } else if (actualPaceSeconds > upperBound) {
          complianceStatus = 'PARTIAL';
          feedback = "Ritmo lento demais.";
        } else {
          feedback = "Ritmo de prova validado com precisão militar.";
        }
      }
    }

    // Persiste o resultado tático na planilha do atleta
    await db.update(plannedWorkouts)
      .set({ 
        complianceStatus,
        // @ts-ignore - Salva a narrativa de auditoria, se suportada
        complianceFeedback: feedback 
      })
      .where(eq(plannedWorkouts.id, plannedWorkoutId));

    console.log(`[Coach Auditor] Workout ID: ${plannedWorkoutId} | Status: ${complianceStatus} | Info: ${feedback}`);

    return { complianceStatus, feedback };
  }
};