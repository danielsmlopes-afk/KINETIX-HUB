import { stravaRepository } from '../repositories/stravaRepository';
import { env } from '../config/env';

export interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  type: string;
  start_date: string;
  gear_id: string | null;
  total_elevation_gain: number;
  workout_type?: number; // 1 = Race (Prova), 2 = Long Run, 3 = Workout
  start_latlng?: [number, number];
  map?: {
    id: string;
    summary_polyline: string;
  };
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

  async getAthleteActivities(athleteId: string, page: number = 1, perPage: number = 30): Promise<StravaActivity[]> {
    const token = await this.getValidToken(athleteId);
    const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Falha ao buscar histórico de atividades no Strava.');
    
    return await response.json();
  }
}