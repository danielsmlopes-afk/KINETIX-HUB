import { Context } from 'hono';
import { strengthRepository } from '@/repositories/strengthRepository';
import { athleteRepository } from '@/repositories/athleteRepository';
import { db } from '@/db';
import { workoutSessions, strengthLogs, workoutTemplateItems, exerciseLibrary } from '@/db/schema';
import { env } from '@/config/env';
import { eq, and } from 'drizzle-orm';
import { getTodayWeather, getCityFromCoordinates } from '@/services/weatherService';

interface StrengthLogPayload {
  exerciseId: string;
  actualSets: number;
  actualReps: string;
  weightUsed: number;
  notes?: string;
}

export const strengthController = {
  async listTemplates(c: Context) {
    try {
      const templates = await strengthRepository.getAllWorkoutTemplates();
      
      return c.json({ data: templates });
    } catch (error) {
      console.error('❌ [STRENGTH CONTROLLER] Erro ao buscar fichas:', error);
      return c.json({ error: "Erro interno ao buscar as fichas de treino.", code: "FETCH_ERR" }, 500);
    }
  },

  async getTemplateExercises(c: Context) {
    try {
      const templateId = c.req.param('id');

      if (!templateId) {
        return c.json({ error: "O parâmetro ID da ficha é obrigatório.", code: "MISSING_PARAM" }, 400);
      }
      
      const exercises = await db.select({
        id: workoutTemplateItems.id,
        templateId: workoutTemplateItems.templateId,
        exerciseId: exerciseLibrary.id,
        exerciseName: exerciseLibrary.name,
        sets: workoutTemplateItems.sets,
        reps: workoutTemplateItems.reps,
        notes: workoutTemplateItems.notes
      })
      .from(workoutTemplateItems)
      .innerJoin(exerciseLibrary, eq(workoutTemplateItems.exerciseId, exerciseLibrary.id))
      .where(eq(workoutTemplateItems.templateId, templateId));

      return c.json({ data: exercises }, 200);
    } catch (error) {
      console.error('❌ [STRENGTH CONTROLLER] Erro ao buscar exercícios do template:', error);
      return c.json({ error: "Erro interno ao buscar exercícios.", code: "FETCH_ERR" }, 500);
    }
  },

  async logWorkout(c: Context) {
    try {
      const body = await c.req.json().catch(() => ({}));
      const templateName = String(body.templateName || 'Treino de Força');
      const durationMinutes = Number(body.durationMinutes || 60);
      let location = body.location ? String(body.location) : '';
      const lat = body.lat ? Number(body.lat) : undefined;
      const lng = body.lng ? Number(body.lng) : undefined;

      // Faz a ponte inteligente caso os dados venham do App Flutter (logs) ou de outro lugar (exercises)
      const itemsToLog = (Array.isArray(body.logs) && body.logs.length > 0 ? body.logs : (body.exercises || [])) as StrengthLogPayload[];

      const athlete = await athleteRepository.getPrimaryAthlete();
      if (!athlete) {
        return c.json({ error: "Atleta não encontrado.", code: "ATHLETE_NOT_FOUND" }, 404);
      }

      // Fallback de localidade: 1º Coordenadas do App (Geolocator), 2º Âncora do Atleta
      if (!location && lat !== undefined && lng !== undefined) {
        location = await getCityFromCoordinates(lat, lng);
      } else if (!location && athlete.homeLat && athlete.homeLon) {
        location = await getCityFromCoordinates(athlete.homeLat, athlete.homeLon);
      }
      if (!location || location === 'Localização Mapeada' || location.includes('Sem API Key')) {
        location = 'São Paulo'; // Fallback final
      }

      // Operação Meteorologia: Busca o clima atual do IronLog com a localidade dinâmica
      const weatherStr = await getTodayWeather(location);

      // Delegação para o Repositório persistir a sessão e os logs
      const session = await strengthRepository.saveStrengthLog(athlete.id, durationMinutes, itemsToLog, weatherStr);

      // Notificação de Sucesso via Telegram Bot
      const telegramMessage = `💪 *Excelente, Comandante!*\n\nO *${templateName}* foi concluído e registado com sucesso (${durationMinutes} min).\n🌡️ Clima do Laboratório: ${weatherStr} (${location})\n\nContinue executando a missão.`;
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: telegramMessage,
          parse_mode: 'Markdown'
        })
      }).catch(err => console.error('❌ Falha ao enviar notificação via Telegram:', err));

      return c.json({ data: { message: `💪 Excelente, Comandante! ${templateName} concluído e registado.`, session } }, 201);
    } catch (error) {
      console.error('❌ [STRENGTH CONTROLLER] Erro ao registrar treino:', error);
      return c.json({ error: "Erro interno ao registrar treino de força.", code: "LOG_ERR" }, 500);
    }
  },

  // Método para gerar a Auditoria de Força (Planeado vs Realizado)
  async getAudit(c: Context) {
    try {
      const sessionId = c.req.param('sessionId');
      const templateId = c.req.query('templateId');

      if (!sessionId || !templateId) {
        return c.json({ error: "sessionId na rota e templateId na query são necessários.", code: "MISSING_PARAMS" }, 400);
      }

      const audit = await db.select({
        exerciseName: exerciseLibrary.name,
        plannedSets: workoutTemplateItems.sets,
        plannedReps: workoutTemplateItems.reps,
        actualSets: strengthLogs.actualSets,
        actualReps: strengthLogs.actualReps,
        weightUsed: strengthLogs.weightUsed,
      })
      .from(strengthLogs)
      .innerJoin(exerciseLibrary, eq(strengthLogs.exerciseId, exerciseLibrary.id))
      .innerJoin(workoutTemplateItems, and(eq(workoutTemplateItems.exerciseId, exerciseLibrary.id), eq(workoutTemplateItems.templateId, templateId)))
      .where(eq(strengthLogs.sessionId, sessionId));

      return c.json({ data: audit }, 200);
    } catch (error) {
      console.error('❌ [STRENGTH CONTROLLER] Erro ao buscar auditoria:', error);
      return c.json({ error: "Erro interno ao buscar a auditoria.", code: "AUDIT_ERR" }, 500);
    }
  }
};