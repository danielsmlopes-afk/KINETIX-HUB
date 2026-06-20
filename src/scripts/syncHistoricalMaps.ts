import { db } from '@/db';
import { sql } from 'drizzle-orm';
import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import polyline from '@mapbox/polyline';
import { env } from '@/config/env';

// =================================================================
// 🛡️ INICIALIZAÇÃO BLINDADA VIA ARQUIVO JSON (À PROVA DE ERROS) 🛡️
// =================================================================
// Procura o arquivo de credenciais em locais estratégicos para resiliência
const possiblePaths = [
  path.resolve(__dirname, '../config/firebase-map-service-account.json'), // Padrão (src/config/)
  path.resolve(process.cwd(), 'firebase-map-service-account.json')      // Fallback (Raiz do projeto)
];
const serviceAccountPath = possiblePaths.find(p => fs.existsSync(p));

if (!serviceAccountPath) {
  console.error(`\n❌ FATAL: Arquivo 'firebase-map-service-account.json' não encontrado.\n\nVerifique se o arquivo foi baixado e colocado em um dos seguintes locais:\n1. ${possiblePaths[0]}\n2. ${possiblePaths[1]}\n`);
  process.exit(1);
}

console.log(`ℹ️ Usando arquivo de credenciais de: ${serviceAccountPath}`);
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Inicialização Secundária do Firebase (Motor Cartográfico/Mapas)
const mapApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: env.FIREBASE_MAP_STORAGE_BUCKET
}, 'mapApp');

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function processMap(
  id: string,
  athleteId: string,
  encodedPolyline: string,
  label: string,
  tableName: 'workout_sessions' | 'races' | 'monument_records',
  bucket: any,
  mapsBaseUrl: string,
  mapsApiKey: string
): Promise<boolean> {
  let mapUrl = '';
  const isGeoapify = mapsBaseUrl.includes('geoapify');

  if (isGeoapify) {
    // Geoapify não suporta polylines codificadas nativamente no GET.
    // Decodificamos e reduzimos os pontos para caber no limite de URL.
    const decoded = polyline.decode(encodedPolyline);
    const maxPoints = 80;
    const step = Math.ceil(decoded.length / maxPoints);
    const sampled = decoded.filter((_, idx: number) => idx % step === 0);
    
    // Garante o fechamento/ponto final
    if (sampled.length > 0 && decoded.length > 0 && sampled[sampled.length - 1] !== decoded[decoded.length - 1]) {
      sampled.push(decoded[decoded.length - 1]);
    }

    // Geoapify espera: geometry=polyline:lon1,lat1,lon2,lat2,...;linecolor:#ff0000;linewidth:3
    const coordsString = sampled.map((c: number[]) => `${c[1]},${c[0]}`).join(',');
    mapUrl = `${mapsBaseUrl}?style=osm-carto&width=500&height=300&geometry=polyline:${coordsString};linecolor:%23ff0000;linewidth:3&apiKey=${mapsApiKey}`;
  } else {
    // Codifica todo o valor do parâmetro 'path', garantindo que os caracteres como '|' fiquem URL-safe (%7C)
    const pathParam = encodeURIComponent(`stroke:red|width:3|enc:${encodedPolyline}`);
    mapUrl = `${mapsBaseUrl}/auto/500x300.png?key=${mapsApiKey}&path=${pathParam}`;
  }

  // Fetch do buffer da imagem
  const response = await fetch(mapUrl);
  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    let errorText = 'Sem detalhes adicionais';
    
    if (contentType.includes('image')) {
      errorText = `[Imagem de erro retornada pela API (Corpo Binário bloqueado pelo parser) - HTTP ${response.status}]`;
      await response.arrayBuffer(); // Consome o corpo para liberar a memória e limpar a stream
    } else {
      errorText = await response.text().catch(() => 'Erro ao ler texto da resposta');
    }
    
    const safeUrl = mapUrl.replace(mapsApiKey, '***CHAVE_OCULTA***');
    console.error(`❌ Erro no Provedor de Mapas para o registro ${id} (${label}): ${response.status} ${response.statusText}`);
    console.error(`   Detalhes da API: ${errorText}`);
    console.error(`   URL Tentada: ${safeUrl}\n`);
    return false;
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  // Upload do buffer para o Firebase secundário (mapApp)
  const filePath = `maps/${athleteId}/${id}.png`;
  const file = bucket.file(filePath);

  await file.save(imageBuffer, {
    metadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000' },
  });

  // Tornar arquivo público, capturar a URL e Atualizar Neon DB
  await file.makePublic();
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

  if (tableName === 'workout_sessions') {
    await db.execute(sql`UPDATE workout_sessions SET map_image_url = ${publicUrl} WHERE id = ${id}`);
  } else if (tableName === 'races') {
    await db.execute(sql`UPDATE races SET map_image_url = ${publicUrl} WHERE id = ${id}`);
  } else {
    await db.execute(sql`UPDATE monument_records SET map_image_url = ${publicUrl} WHERE id = ${id}`);
  }
  
  console.log(`✅ Sucesso! Mapa de ${label} salvo em: ${publicUrl}`);
  return true;
}

async function syncHistoricalMaps() {
  console.log('🚀 Iniciando Backfill Cartográfico (Geoapify/MapTiler -> Firebase MapApp)...');

  try {
    const bucket = mapApp.storage().bucket();
    const mapsBaseUrl = process.env.MAPS_BASE_URL;
    const mapsApiKey = process.env.MAPS_API_KEY;

    if (!mapsBaseUrl || !mapsApiKey) {
      throw new Error('❌ Faltam as credenciais do provedor de mapas (MAPS_BASE_URL ou MAPS_API_KEY) no .env');
    }

    // 1. Obter ID do Atleta Principal
    let defaultAthleteId = 'unknown';
    try {
      const primaryAthlete = await db.execute(sql`SELECT id FROM athletes LIMIT 1`);
      if (primaryAthlete.rows.length > 0) {
        defaultAthleteId = primaryAthlete.rows[0].id as string;
      }
    } catch (e) {
      console.warn('⚠️ Não foi possível obter o ID do atleta principal no banco de dados. Usando "unknown".', e);
    }

    let processed = 0;

    // 2. Buscar registros no histórico onde a polyline de treino existe mas a imagem não
    const sessionRecords = await db.execute(sql`
      SELECT id, athlete_id, map_polyline as polyline
      FROM workout_sessions 
      WHERE map_polyline IS NOT NULL AND map_image_url IS NULL
    `);

    console.log(`🔍 Encontrados ${sessionRecords.rows.length} treinos (workout_sessions) para processamento.`);

    for (const record of sessionRecords.rows) {
      const { id, athlete_id, polyline } = record;
      const athleteUuid = athlete_id || defaultAthleteId;
      
      try {
        console.log(`⚙️ Processando treino: ${id} (Atleta: ${athleteUuid})`);
        const success = await processMap(
          id as string,
          athleteUuid as string,
          polyline as string,
          `treino ${id}`,
          'workout_sessions',
          bucket,
          mapsBaseUrl,
          mapsApiKey
        );
        if (success) processed++;
      } catch (err) {
        console.error(`❌ Erro processando treino ${id}:`, err);
      }

      await delay(1500);
    }

    // 3. Buscar registros no histórico onde a polyline de prova existe mas a imagem não
    const raceRecords = await db.execute(sql`
      SELECT id, name, polyline
      FROM races 
      WHERE polyline IS NOT NULL AND map_image_url IS NULL
    `);

    console.log(`🔍 Encontradas ${raceRecords.rows.length} provas (races) para processamento.`);

    for (const record of raceRecords.rows) {
      const { id, name, polyline } = record;
      
      try {
        console.log(`⚙️ Processando prova: ${name || id} (ID: ${id})`);
        const success = await processMap(
          id as string,
          defaultAthleteId,
          polyline as string,
          `prova "${name || id}"`,
          'races',
          bucket,
          mapsBaseUrl,
          mapsApiKey
        );
        if (success) processed++;
      } catch (err) {
        console.error(`❌ Erro processando prova ${id}:`, err);
      }

      await delay(1500);
    }

    // 4. Buscar registros no histórico de monumentos onde a polyline existe mas a imagem não
    const monumentRecordsToSync = await db.execute(sql`
      SELECT id, event_name as name, polyline
      FROM monument_records 
      WHERE polyline IS NOT NULL AND (map_image_url IS NULL OR map_image_url NOT LIKE 'http%')
    `);

    console.log(`🔍 Encontrados ${monumentRecordsToSync.rows.length} monumentos (monument_records) para processamento.`);

    for (const record of monumentRecordsToSync.rows) {
      const { id, name, polyline: encPolyline } = record;
      
      try {
        console.log(`⚙️ Processando monumento: ${name || id} (ID: ${id})`);
        const success = await processMap(
          id as string,
          defaultAthleteId,
          encPolyline as string,
          `monumento "${name || id}"`,
          'monument_records',
          bucket,
          mapsBaseUrl,
          mapsApiKey
        );
        if (success) processed++;
      } catch (err) {
        console.error(`❌ Erro processando monumento ${id}:`, err);
      }

      await delay(1500);
    }

    console.log(`🎉 Backfill Concluído! ${processed} mapas gerados no total.`);
    
    // Hack tático para Windows: Aguarda o I/O de rede e BD fechar suavemente antes de derrubar o processo
    setTimeout(() => process.exit(0), 500);
  } catch (error) {
    console.error('💥 Erro fatal no script de sincronização:', error);
    setTimeout(() => process.exit(1), 500);
  }
}

syncHistoricalMaps();