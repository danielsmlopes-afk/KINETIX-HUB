import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { plannedWorkouts } from '@/db/schema';
import { StravaActivity } from '@/services/stravaService';
import { askHeadCoach } from '@/services/headCoachService';
import { TREADMILL_AUDITOR_PROMPT } from '@/services/treadmillProtocol';

/**
 * Utilitário: Converte pace formatado (ex: "07:10") para segundos totais.
 */
function parsePaceToSeconds(paceStr: string): { min: number, max: number } {
  if (!paceStr) return { min: 0, max: 0 };
  const matches = paceStr.match(/\d{1,2}:\d{2}/g);
  if (!matches || matches.length === 0) return { min: 0, max: 0 };
  
  const parseSingle = (p: string) => {
    const [m, s] = p.split(':').map(Number);
    return m * 60 + s;
  };
  
  const p1 = parseSingle(matches[0]);
  if (matches.length > 1) {
    const p2 = parseSingle(matches[1]);
    return { min: Math.min(p1, p2), max: Math.max(p1, p2) };
  }
  return { min: p1, max: p1 };
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

    const targetPace = parsePaceToSeconds(targetPaceStr);

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
      } else if (targetPace.min > 0) {
        let minBound = targetPace.min;
        let maxBound = targetPace.max;
        
        // Se for um pace único (sem range), aplica uma tolerância de +/- 5s
        if (minBound === maxBound) {
            minBound -= 5;
            maxBound += 5;
        }

        if (actualPaceSeconds < minBound) {
          complianceStatus = 'PARTIAL';
          const pStr = `${Math.floor(actualPaceSeconds/60)}:${Math.floor(actualPaceSeconds%60).toString().padStart(2,'0')}`;
          feedback = `Ritmo forte demais (${pStr}). Fora da janela estipulada (${targetPaceStr}). Risco de fadiga residual.`;
        } else if (actualPaceSeconds > maxBound) {
          complianceStatus = 'PARTIAL';
          const pStr = `${Math.floor(actualPaceSeconds/60)}:${Math.floor(actualPaceSeconds%60).toString().padStart(2,'0')}`;
          feedback = `Ritmo muito lento (${pStr}). Fora da janela estipulada (${targetPaceStr}).`;
        } else {
          feedback = `Ritmo validado com precisão militar, cravado na janela de combate (${targetPaceStr}).`;
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
