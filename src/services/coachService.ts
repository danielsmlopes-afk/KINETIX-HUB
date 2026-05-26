import { db } from '@/db';
import { athletes, plannedWorkouts } from '@/db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';
import { env } from '@/config/env';
import { telegramMessageService } from '@/services/telegramMessageService';
import { validateTreadmillIntervals } from '@/services/treadmillProtocol';

export type StravaRunData = {
  id: number;
  name: string;
  distanceKm: number;
  movingTimeSeconds: number;
  paceStr: string;
  elevationGain: number;
  hasGps?: boolean;
  isTrainer?: boolean;
  laps?: Array<{ distanceMeters: number; movingTimeSeconds: number }>;
};

export const coachService = {
  async analyzeRunActivity(stravaData: StravaRunData): Promise<void> {
    try {
      console.log(`[Coach IA] Iniciando análise paramétrica para: ${stravaData.name}`);
      
      const athleteList = await db.select().from(athletes).limit(1);
      if (athleteList.length === 0) return;
      const athlete = athleteList[0];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const planned = await db.select()
        .from(plannedWorkouts)
        .where(
          and(
            eq(plannedWorkouts.athleteId, athlete.id),
            eq(plannedWorkouts.activityType, 'RUN'),
            gte(plannedWorkouts.date, today),
            lt(plannedWorkouts.date, tomorrow)
          )
        ).limit(1);

      let targetDistance = 'Não especificado (Treino Livre)';
      let targetPace = 'Livre';
      let plannedWarmup = 'Não especificado';
      let plannedCooldown = 'Não especificado';
      let plannedRest = '';
      let plannedIntervals: Array<{ distanceMeters: number; speedKmh: number }> | undefined;

      if (planned.length > 0) {
        const details = (planned[0].details as Record<string, unknown>) || {};
        const subtitle = String(details.subtitle || '');
        const distMatch = subtitle.match(/(\d+(?:[.,]\d+)?)\s*km/i);
        if (distMatch) targetDistance = `${distMatch[1]} km`;
        
        const paceMatch = subtitle.match(/(\d{1,2}:\d{2})/);
        if (paceMatch) targetPace = `${paceMatch[1]} min/km`;
        
        if (planned[0].warmup) plannedWarmup = planned[0].warmup;
        if (planned[0].cooldown) plannedCooldown = planned[0].cooldown;
        if (planned[0].restDetails) plannedRest = planned[0].restDetails;
        if (Array.isArray(details.intervals)) {
          plannedIntervals = details.intervals as Array<{ distanceMeters: number; speedKmh: number }>;
        }
        
        // --- MOTOR DE VALIDAÇÃO DE COMPLIANCE (RUA VS. ESTEIRA) ---
        let complianceStatus = 'COMPLETED_NOT_VALIDATED';
        let targetDistVal = 0;
        let targetPaceSecs = 0;
        
        if (targetDistance !== 'Não especificado (Treino Livre)') {
          targetDistVal = parseFloat(targetDistance.replace(' km', '').replace(',', '.'));
        }
        if (targetPace !== 'Livre') {
          const [m, s] = targetPace.replace(' min/km', '').split(':').map(Number);
          targetPaceSecs = (m * 60) + (s || 0);
        }

        if (stravaData.isTrainer || stravaData.hasGps === false) {
          // REGRA INDOOR: TREADMILL PROTOCOL
          const isValid = validateTreadmillIntervals(
            { 
              targetDistanceKm: targetDistVal, 
              targetPace: targetPace,
              restDetails: plannedRest,
              intervals: plannedIntervals
            },
            { distanceKm: stravaData.distanceKm, movingTimeSeconds: stravaData.movingTimeSeconds, laps: stravaData.laps }
          );
          complianceStatus = isValid ? 'VALIDATED' : 'COMPLETED_NOT_VALIDATED';
        } else {
          // REGRA OUTDOOR: RUA/GPS
          const isVolumeValid = targetDistVal > 0 
            ? (stravaData.distanceKm >= targetDistVal * 0.97 && stravaData.distanceKm <= targetDistVal * 1.03) 
            : true;
            
          let isIntensityValid = true;
          if (targetPaceSecs > 0) {
            const [am, as] = stravaData.paceStr.split(':').map(Number);
            isIntensityValid = Math.abs((am * 60 + (as || 0)) - targetPaceSecs) <= 15;
          }
          complianceStatus = (isVolumeValid && isIntensityValid) ? 'VALIDATED' : 'COMPLETED_NOT_VALIDATED';
        }

        console.log(`[VALIDATION_ENGINE]: Workout ${planned[0].id} marked as ${complianceStatus}`);
        await db.update(plannedWorkouts).set({ complianceStatus }).where(eq(plannedWorkouts.id, planned[0].id));
      }

      const prompt = `Você é o Head Coach IA do sistema BioMedal V11. O atleta está em preparação para a prova P1: Nike SP City 21K (meta: 2:18:00 a 2:28:00, pace 6:32 a 7:00/km).

Dados da Corrida Realizada (${stravaData.name}):
- Distância Real: ${stravaData.distanceKm} km
- Pace Médio Real: ${stravaData.paceStr} min/km
- Altimetria Acumulada: ${stravaData.elevationGain} m

Dados Planejados para Hoje:
- Distância Alvo: ${targetDistance}
- Pace Alvo: ${targetPace}
- Aquecimento Sugerido: ${plannedWarmup}
- Desaquecimento Sugerido: ${plannedCooldown}

Gere um relatório analítico curto, direto e militar (máximo 3 parágrafos) avaliando:
1. A precisão do ritmo e do volume em relação ao objetivo do dia, avaliando se os trechos de aquecimento e desaquecimento propostos parecem ter sido englobados no esforço total.
2. O impacto da altimetria no desgaste articular e carga interna.
3. O nível de prontidão para suportar o ritmo da prova P1 nas próximas semanas.`;

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      const data = await geminiRes.json() as Record<string, any>;
      const aiAnalysis = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Análise indisponível no momento.';

      await telegramMessageService.sendCoachFeedback(stravaData, aiAnalysis);
    } catch (error) { console.error('❌ [Coach IA] Erro ao analisar atividade:', error); }
  },

  async updateComplianceStatus(workoutId: string, status: 'VALIDATED' | 'MISSED' | 'COMPLETED_NOT_VALIDATED'): Promise<void> {
    try {
      const result = await db.update(plannedWorkouts)
        .set({ complianceStatus: status })
        .where(eq(plannedWorkouts.id, workoutId))
        .returning({ id: plannedWorkouts.id });

      if (result.length === 0) {
        throw new Error(`Treino com ID ${workoutId} não encontrado.`);
      }

      console.log(`[MANUAL_OVERRIDE]: Workout ${workoutId} compliance forced to ${status}`);
    } catch (error) {
      console.error(`❌ [Coach IA] Erro ao atualizar status de compliance:`, error);
      throw error;
    }
  }
};