import { env } from '@/config/env';

async function register() {
  const callbackUrl = 'https://superbowl-kiln-poppy.ngrok-free.dev/api/strava/webhook';

  console.log('📡 Registrando webhook no Strava...');
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