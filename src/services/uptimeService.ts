export async function toggleMonitor(status: 0 | 1) {
  const apiKey = process.env.UPTIMEROBOT_API_KEY;
  const monitorId = process.env.UPTIMEROBOT_MONITOR_ID;

  if (!apiKey || !monitorId) {
    console.error('❌ [UptimeRobot] Chaves ausentes no .env');
    return;
  }

  try {
    const response = await fetch('https://api.uptimerobot.com/v2/editMonitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        api_key: apiKey,
        format: 'json',
        id: monitorId,
        status: status.toString()
      })
    });

    const data = await response.json();
    if (data.stat === 'ok') {
      console.log(`🤖 [UptimeRobot] Monitor ${monitorId} alterado para: ${status === 0 ? 'PAUSADO' : 'ATIVO'}`);
    } else {
      console.error(`❌ [UptimeRobot] Erro na API:`, data.error?.message);
    }
  } catch (error) {
    console.error('❌ [UptimeRobot] Falha na requisição:', error);
  }
}
