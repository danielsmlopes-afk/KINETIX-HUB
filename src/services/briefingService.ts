export function generateDailyBriefing(workoutDetails: string, weatherForecast: string, activityEmoji: string = '🎯', isRestDay: boolean = false): string {
  const footerMessage = isRestDay ? "Boa recuperação!" : "Bom treino e foco no processo!";
  return `🤖 *BRIEFING DIÁRIO KINETIX*\n\n` +
         `${activityEmoji} *Sessão:* ${workoutDetails}\n\n` +
         `🌤 *Clima esperado:* ${weatherForecast}\n\n${footerMessage}`;
}

export function generatePreRaceChecklist(raceTime: string, temp: number, gels: number): string {
  return `🏆 *CHECKLIST PRÉ-PROVA - VÉSPERA*\n\n` +
         `⏰ *Largada:* ${raceTime}\n🌡 *Temperatura:* ${temp}°C\n` +
         `🔋 *Estratégia Nutricional:* ${gels} Géis de carboidrato separados.\nPrepare a armadura e descanse!`;
}