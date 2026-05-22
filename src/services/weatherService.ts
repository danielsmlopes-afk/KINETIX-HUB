import { env } from '@/config/env';

export async function getCityFromCoordinates(lat: number, lng: number): Promise<string> {
  if (!env.OPENWEATHER_API_KEY) {
    return 'Coordenadas Recebidas (Sem API Key)';
  }

  try {
    const url = `http://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lng}&limit=1&appid=${env.OPENWEATHER_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) return 'Localização Mapeada';
    
    const data = await response.json();
    if (data && data.length > 0) {
      const city = data[0].local_names?.pt || data[0].name;
      const state = data[0].state || '';
      return state ? `${city}, ${state}` : city;
    }
  } catch (error) {
    console.error('❌ [WEATHER SERVICE] Erro ao buscar cidade:', error);
  }
  return 'Localização Mapeada';
}

export async function getHistoricalWeather(lat: number, lng: number, dateISO: string): Promise<string | null> {
  try {
    const dateStr = dateISO.split('T')[0]; // Pega apenas o YYYY-MM-DD
    const hourStr = dateISO.split('T')[1].substring(0, 2); // Pega a Hora (UTC)
    const hourIndex = parseInt(hourStr, 10);

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${dateStr}&end_date=${dateStr}&hourly=temperature_2m&timezone=UTC`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data?.hourly?.temperature_2m && data.hourly.temperature_2m[hourIndex] !== null) {
      return `${Math.round(data.hourly.temperature_2m[hourIndex])}°C`;
    }
  } catch (error) {
    console.error('❌ [WEATHER SERVICE] Erro ao buscar clima histórico:', error);
  }
  return null;
}

export async function getTomorrowWeather(city: string = 'São Paulo'): Promise<string> {
  if (!env.OPENWEATHER_API_KEY) {
    return '24°C, Céu limpo (Sem API Key)';
  }

  try {
    const url = `http://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&lang=pt_br&appid=${env.OPENWEATHER_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) return 'Previsão Indisponível';
    
    const data = await response.json();
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    // Busca a previsão para as 06h de amanhã, ou a primeira que o OWM devolver do dia
    const forecast = data.list.find((item: any) => item.dt_txt.includes(`${dateStr} 06:00:00`)) || data.list.find((item: any) => item.dt_txt.includes(dateStr));
    if (forecast) {
      const desc = forecast.weather[0].description;
      return `${Math.round(forecast.main.temp)}°C, ${desc.charAt(0).toUpperCase() + desc.slice(1)}`;
    }
  } catch (error) {
    console.error('❌ [WEATHER SERVICE] Erro ao buscar previsão do tempo:', error);
  }
  return 'Previsão Indisponível';
}