import { env } from '@/config/env';

async function register() {
  const callbackUrl = `${process.env.RENDER_EXTERNAL_URL || 'https://kinetix-api-7jld.onrender.com'}/api/strava/webhook`;

  // 1. Verifica se já existe um webhook registrado
  console.log('🔍 Verificando webhooks existentes...');
  const checkResponse = await fetch(`https://www.strava.com/api/v3/push_subscriptions?client_id=${env.STRAVA_CLIENT_ID}&client_secret=${env.STRAVA_CLIENT_SECRET}`);
  const existingSubs = await checkResponse.json();

  if (Array.isArray(existingSubs) && existingSubs.length > 0) {
    console.log(`⚠️ Encontrada(s) ${existingSubs.length} assinatura(s) antiga(s). Apagando para liberar espaço...`);
    for (const sub of existingSubs) {
      await fetch(`https://www.strava.com/api/v3/push_subscriptions/${sub.id}?client_id=${env.STRAVA_CLIENT_ID}&client_secret=${env.STRAVA_CLIENT_SECRET}`, {
        method: 'DELETE'
      });
      console.log(`🗑️ Assinatura antiga (${sub.id}) deletada com sucesso.`);
    }
  }

  // 2. Registra o novo webhook
  console.log('📡 Registrando novo webhook no Strava...');
  const response = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      callback_url: callbackUrl,
      verify_token: env.STRAVA_VERIFY_TOKEN
    })
  });

  const data = await response.json();
  console.log('✅ Resposta do Strava:', data);
}

register().catch(console.error);
