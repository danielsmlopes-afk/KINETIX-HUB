import { stravaRepository } from '../repositories/stravaRepository';
import { env } from '../config/env';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { plannedWorkouts, monumentRecords } from '@/db/schema';
import { getHistoricalWeather } from './weatherService';
import { askHeadCoach } from './headCoachService';
import { telegramMessageService } from './telegramMessageService';
import { athleteRepository } from '@/repositories/athleteRepository';

export interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  type: string;
  start_date: string;
  start_date_local?: string;
  gear_id: string | null;
  total_elevation_gain: number;
  average_speed?: number;
  average_heartrate?: number;
  trainer?: boolean;
  workout_type?: number; // 1 = Race (Prova), 2 = Long Run, 3 = Workout
  start_latlng?: [number, number];
  map?: {
    id: string;
    summary_polyline: string;
  };
  laps?: Array<{
    distance: number;
    moving_time: number;
  }>;
}

export class StravaService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor() {
    this.clientId = env.STRAVA_CLIENT_ID || '';
    this.clientSecret = env.STRAVA_CLIENT_SECRET || '';
    this.redirectUri = env.STRAVA_REDIRECT_URI || 'http://localhost:3000/api/strava/callback';
  }

  getAuthUrl(): string {
    const scope = 'activity:read_all,profile:read_all';
    return `https://www.strava.com/oauth/authorize?client_id=${this.clientId}&response_type=code&redirect_uri=${encodeURIComponent(this.redirectUri)}&approval_prompt=force&scope=${scope}`;
  }

  async exchangeToken(code: string) {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Falha na troca de token do Strava: ${response.statusText}. Detalhes: ${JSON.stringify(errorData)}`);
    }

    return await response.json();
  }

  async getValidToken(athleteId: string): Promise<string> {
    const tokens = await stravaRepository.getTokens(athleteId);
    
    if (!tokens || !tokens.stravaAccessToken) {
      throw new Error('Atleta não autenticado com o Strava.');
    }

    const now = Math.floor(Date.now() / 1000);
    // Renova o token se estiver expirado ou expirando em menos de 5 minutos (300s)
    if (tokens.stravaExpiresAt && tokens.stravaExpiresAt < now + 300) {
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: tokens.stravaRefreshToken
        })
      });

      if (!response.ok) throw new Error('Falha ao renovar token do Strava');
      
      const data = await response.json();
      await stravaRepository.saveTokens(athleteId, data.access_token, data.refresh_token, data.expires_at);
      return data.access_token;
    }

    return tokens.stravaAccessToken;
  }

  async getActivityDetails(athleteId: string, activityId: number): Promise<StravaActivity> {
    const token = await this.getValidToken(athleteId);
    
    const response = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Falha ao buscar detalhes da atividade ${activityId} no Strava.`);
    }

    return await response.json();
  }

  async getAthleteActivities(athleteId: string, page: number = 1, perPage: number = 30, after?: number, before?: number): Promise<StravaActivity[]> {
    const token = await this.getValidToken(athleteId);
    const url = new URL('https://www.strava.com/api/v3/athlete/activities');
    url.searchParams.append('page', page.toString());
    url.searchParams.append('per_page', perPage.toString());
    if (after) url.searchParams.append('after', after.toString());
    if (before) url.searchParams.append('before', before.toString());

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Falha ao buscar histórico de atividades no Strava.');
    
    return await response.json();
  }

  async scanAndLogEnduranceRun(): Promise<void> {
    try {
    console.log('🤖[Digital Twin V12.2] Iniciando varredura de Endurance (Longão)...');
    const athlete = await athleteRepository.getPrimaryAthlete();
    if (!athlete) return;

    const spDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const today = new Date(`${spDateStr}T00:00:00`);
    const startOfToday = new Date(today);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const activities = await this.getAthleteActivities(athlete.id, 1, 10, Math.floor(startOfToday.getTime() / 1000), Math.floor(endOfToday.getTime() / 1000));
    
    const longRun = activities
        .filter(a => a.type === 'Run' && (a.distance / 1000) >= 4.9)
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0];

    if (!longRun) {
        console.log('✅[Digital Twin] Nenhum longão encontrado para hoje.');
        return;
    }

    const planned = await db.select().from(plannedWorkouts).where(
        and(
            eq(plannedWorkouts.athleteId, athlete.id),
            gte(plannedWorkouts.date, startOfToday),
            lte(plannedWorkouts.date, endOfToday),
            eq(plannedWorkouts.activityType, 'RUN')
        )
    ).orderBy(plannedWorkouts.date).limit(1);

    if (!planned.length) {
        console.log('⚠️[Digital Twin] Longão encontrado no Strava, mas sem treino correspondente na planilha.');
        return;
    }
    const plannedWorkout = planned[0];

    let weather = 'N/A';
    let weatherVespera = 'N/A';
    if (longRun.start_latlng && longRun.start_latlng.length === 2) {
        weather = await getHistoricalWeather(longRun.start_latlng[0], longRun.start_latlng[1], longRun.start_date) || 'N/A';
        
        // Retrocesso matemático de 24 horas (Véspera do treino)
        const runDate = new Date(longRun.start_date);
        const prevDayDate = new Date(runDate.getTime() - (24 * 60 * 60 * 1000));
        weatherVespera = await getHistoricalWeather(longRun.start_latlng[0], longRun.start_latlng[1], prevDayDate.toISOString()) || 'N/A';
    }

    const context = {
        distanciaReal: (longRun.distance / 1000).toFixed(2),
        paceReal: new Date(longRun.moving_time * 1000).toISOString().substr(14, 5),
        cardio: longRun.average_heartrate,
        clima: weather,
        climaVespera: weatherVespera,
        planejado: plannedWorkout.details,
    };
    const prompt = `Atue como fisiologista de endurance. Analise a performance do longão cruzando as métricas de BPM médio e Pace com o impacto latente da temperatura climática na véspera (sono/madrugada) informada no contexto. Gere um score de 5 a 10 e uma análise de 4 linhas sobre o desempenho e provável 'Cardiac Drift', considerando o planejado. Formato de saída JSON: {"score_performance": X, "analise_ia": "..."}`;
    const aiRawResponse = await askHeadCoach(prompt, context);
    const aiResponse = JSON.parse(aiRawResponse.replace(/```json/g, '').replace(/```/g, '').trim()) as { score_performance: number; analise_ia: string };

    const performanceLog = {
        distancia_real: (longRun.distance / 1000).toFixed(2),
        distancia_meta: (plannedWorkout.details as { corrida?: string })?.corrida,
        pace_real: new Date(longRun.moving_time * 1000).toISOString().substr(14, 5),
        pace_meta: (plannedWorkout.details as { corrida?: string })?.corrida?.match(/@\s*(\d{1,2}:\d{2})/)?.[1],
        laps: longRun.laps,
        cardio: longRun.average_heartrate,
        clima: `Treino: ${weather} | Véspera: ${weatherVespera}`,
        score_performance: aiResponse.score_performance,
        analise_ia: aiResponse.analise_ia,
        feedback_dor: null,
        feedback_hidratacao: null,
    };

    await db.update(plannedWorkouts)
        .set({ longRunPerformanceLog: performanceLog })
        .where(eq(plannedWorkouts.id, plannedWorkout.id));

    const message = `🦾 *Digital Twin: Longão Concluído!*\n\n*Score BioMedal:* ${performanceLog.score_performance}/10\n*Análise IA:* ${aiResponse.analise_ia}\n\nComo você se sentiu? Responda com:\n\`{"dor": "Nenhuma/Leve/Moderada", "hidratacao": "Ok/Insuficiente"}\``;
    await telegramMessageService.sendSimpleMessage(Number(env.TELEGRAM_CHAT_ID), message);
    
    console.log(`✅[Digital Twin] Log de performance do longão salvo para o treino ${plannedWorkout.id}.`);
    } catch (error) {
      console.error('❌ [Digital Twin] Falha sistêmica ou de API durante a varredura do longão:', error);
    }
  }

  async syncHistoricalRaces(): Promise<{ totalImportado: number, prsIdentificados: number }> {
    console.log('🔄 [Hall of Fame] Iniciando Operação Arquivo Morto: Extração Histórica do Strava...');
    const athlete = await athleteRepository.getPrimaryAthlete();
    if (!athlete) throw new Error('Atleta primário não encontrado.');

    // 1. Busca as últimas 200 atividades (Paginando para garantir escopo histórico)
    const activities = await this.getAthleteActivities(athlete.id, 1, 200);
    console.log(`📡 [Hall of Fame] ${activities.length} atividades recebidas. Aplicando filtro tático...`);

    const extractedMonuments: any[] = [];
    
    for (const act of activities) {
      if (act.type !== 'Run') continue;

      let targetDist = '';
      if (act.distance >= 9800 && act.distance <= 10500) targetDist = '10K';
      else if (act.distance >= 20900 && act.distance <= 21500) targetDist = '21K';
      else if (act.distance >= 41800 && act.distance <= 42500) targetDist = '42K';
      
      if (!targetDist) continue;

      const dateObj = new Date(act.start_date_local || act.start_date);
      const year = dateObj.getFullYear();
      
      // Formatação de Tempo Oficial e Pace
      const movingTime = act.moving_time;
      const timeH = Math.floor(movingTime / 3600);
      const timeM = Math.floor((movingTime % 3600) / 60);
      const timeS = Math.floor(movingTime % 60);
      const officialTime = `${timeH > 0 ? timeH + ':' : ''}${timeM.toString().padStart(2, '0')}:${timeS.toString().padStart(2, '0')}`;
      
      const distanceKm = act.distance / 1000;
      const paceDec = (movingTime / 60) / distanceKm;
      const paceM = Math.floor(paceDec);
      const paceS = Math.floor((paceDec - paceM) * 60);
      const pace = `${paceM.toString().padStart(2, '0')}:${paceS.toString().padStart(2, '0')}`;

      extractedMonuments.push({
        athleteId: athlete.id,
        year,
        eventName: act.name,
        distance: targetDist,
        officialTime,
        pace,
        weather: '--', // Sem dados históricos detalhados fáceis no Strava grátis (fallback)
        polyline: act.map?.summary_polyline || null,
        isAllTimePr: false,
        _rawTime: movingTime // Fator matemático para achar os PRs
      });
    }

    // 2. Filtrar duplicatas já existentes no banco (Baseado na assinatura Nome + Ano)
    const existingRecords = await db.select().from(monumentRecords).where(eq(monumentRecords.athleteId, athlete.id));
    const existingSignatures = new Set(existingRecords.map(r => `${r.eventName}-${r.year}`));

    const toInsert = extractedMonuments.filter(m => !existingSignatures.has(`${m.eventName}-${m.year}`));
    
    if (toInsert.length === 0) {
      console.log('✅ [Hall of Fame] Nenhuma nova prova qualificada para importação.');
      return { totalImportado: 0, prsIdentificados: 0 };
    }

    // 3. Processamento e Avaliação de PRs (Crown Jewels) entre a base e o lote
    let prsIdentificados = 0;
    const parseTimeToSecs = (timeStr: string) => {
      const p = timeStr.split(':').map(Number);
      return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
    };

    for (const dist of ['10K', '21K', '42K']) {
      const novosDaDistancia = toInsert.filter(m => m.distance === dist);
      if (novosDaDistancia.length === 0) continue;

      // Acha o melhor tempo entre os recém-importados
      let bestNovo = novosDaDistancia[0];
      for (const m of novosDaDistancia) {
        if (m._rawTime < bestNovo._rawTime) bestNovo = m;
      }

      // Compara com o PR atualmente salvo no banco para a mesma distância
      const existingPr = existingRecords.find(e => e.distance === dist && e.isAllTimePr);
      let isGlobalPr = true;
      
      if (existingPr) {
        const existingTime = parseTimeToSecs(existingPr.officialTime);
        if (bestNovo._rawTime >= existingTime) {
          isGlobalPr = false;
        } else {
          // Golpe de Estado: A nova corrida é melhor. Rebaixa a atual coroa do banco.
          await db.update(monumentRecords).set({ isAllTimePr: false }).where(eq(monumentRecords.id, existingPr.id));
        }
      }

      if (isGlobalPr) {
        bestNovo.isAllTimePr = true;
        prsIdentificados++;
      }
    }

    // 4. Inserção Limpa no Banco (Removendo a propriedade temporária _rawTime)
    const finalInserts = toInsert.map(m => {
      const { _rawTime, ...rest } = m;
      return rest;
    });

    await db.insert(monumentRecords).values(finalInserts);

    console.log(`🏆 [Hall of Fame] Importação concluída! ${finalInserts.length} novas provas. PRs promovidos: ${prsIdentificados}`);
    return { totalImportado: finalInserts.length, prsIdentificados };
  }
}