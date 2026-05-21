export function generateDailyBriefing(workoutDetails: string, weatherForecast: string): string {
  return `🤖 *BRIEFING DIÁRIO KINETIX*\n\n` +
         `🏃‍♂️ *Sessão:* ${workoutDetails}\n` +
         `🌤 *Clima esperado:* ${weatherForecast}\n\nBom treino, mantenha o pace!`;
}

export function generatePreRaceChecklist(raceTime: string, temp: number, gels: number): string {
  return `🏆 *CHECKLIST PRÉ-PROVA - VÉSPERA*\n\n` +
         `⏰ *Largada:* ${raceTime}\n🌡 *Temperatura:* ${temp}°C\n` +
         `🔋 *Estratégia Nutricional:* ${gels} Géis de carboidrato separados.\nPrepare a armadura e descanse!`;
}