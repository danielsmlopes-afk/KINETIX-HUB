import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { plannedWorkouts } from '@/db/schema';
import { StravaActivity } from '@/services/stravaService';
import { askHeadCoach } from '@/services/headCoachService';
import { TREADMILL_AUDITOR_PROMPT } from '@/services/treadmillProtocol';

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

/**
 * DTO para dados de corrida do Strava já processados e prontos para exibição.
 */
export interface StravaRunData {
  id: number;
  name: string;
  distanceKm: number;
  paceStr: string;
  elevationGain: number;
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

    const targetPaceSeconds = parsePaceToSeconds(targetPaceStr);

    if (isIndoor) {
      // CENÁRIO B: Esteira / Indoor (Delegação Total para o Head Coach IA via Protocolo Calibrado V2)
      try {
        const [planned] = await db.select().from(plannedWorkouts).where(eq(plannedWorkouts.id, plannedWorkoutId)).limit(1);
        const aiContext = {
          distanciaStravaKm: actualDistanceKm,
          detalhesPlanilha: planned?.details || {},
        };
        
        const aiPrompt = `Avalie esta missão indoor (esteira). A distância final registrada no Strava foi de ${actualDistanceKm}km. Calcule a distância alvo real usando o ALGORITMO DE SOMA.
Retorne EXATAMENTE um JSON válido com a seguinte estrutura:
{"status": "VALIDATED" ou "PARTIAL", "feedback": "Explicação militar detalhando o seu cálculo do Algoritmo de Soma..."}
(Use "VALIDATED" se a distância do Strava for de no mínimo 95% do volume calculado, caso contrário "PARTIAL").`;
        
        const aiRawResponse = await askHeadCoach(aiPrompt, aiContext, TREADMILL_AUDITOR_PROMPT);
        const aiResponse = JSON.parse(aiRawResponse.replace(/```json/g, '').replace(/```/g, '').trim()) as { status: string; feedback: string };
        
        complianceStatus = aiResponse.status === 'COMPLETED' ? 'VALIDATED' : aiResponse.status;
        feedback = aiResponse.feedback || "Avaliação de esteira validada com sucesso pelo Motor Cognitivo.";
      } catch (err) {
        console.error('[Coach] Erro na auditoria IA de esteira:', err);
        complianceStatus = actualDistanceKm >= targetDistanceKm * 0.95 ? 'VALIDATED' : 'PARTIAL';
        feedback = "Atividade Indoor Detectada: Auditoria via IA indisponível. Validação de segurança básica aplicada.";
      }
    } else {
      // CENÁRIO A: Rua / Outdoor (Matemática Estrita)
      const minDistanceAllowed = targetDistanceKm * 0.95; // Queda tolerável máxima de 5%
      if (actualDistanceKm < minDistanceAllowed) {
        complianceStatus = 'PARTIAL';
        feedback = `Distância abaixo da meta. Realizou ${actualDistanceKm.toFixed(2)}km de ${targetDistanceKm}km.`;
      } else if (targetPaceSeconds > 0) {
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
      } else {
        feedback = "Distância validada com precisão militar. (Pace livre/não estipulado).";
      }
    }

    // Persiste o resultado tático na planilha do atleta
    await db.update(plannedWorkouts)
      .set({ 
        complianceStatus,
        complianceFeedback: feedback 
      })
      .where(eq(plannedWorkouts.id, plannedWorkoutId));

    console.log(`[Coach Auditor] Workout ID: ${plannedWorkoutId} | Status: ${complianceStatus} | Info: ${feedback}`);

    return { complianceStatus, feedback };
  },

  /**
   * Atualiza o status de compliance de um treino manualmente.
   */
  async updateComplianceStatus(workoutId: string, status: 'VALIDATED' | 'MISSED' | 'COMPLETED_NOT_VALIDATED') {
    await db.update(plannedWorkouts)
      .set({ complianceStatus: status })
      .where(eq(plannedWorkouts.id, workoutId));
    console.log(`[Coach Manual] Compliance status for workout ${workoutId} updated to ${status}.`);
  }
};
