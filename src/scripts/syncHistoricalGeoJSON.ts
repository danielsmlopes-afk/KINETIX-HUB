import { env } from '@/config/env';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import polyline from '@mapbox/polyline';

// =================================================================
// 🛡️ INICIALIZAÇÃO BLINDADA VIA ARQUIVO JSON (À PROVA DE ERROS) 🛡️
// =================================================================
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
}, 'mapGeoJsonApp');

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function syncHistoricalGeoJSON() {
  console.log('🚀 Iniciando Backfill Cartográfico (GeoJSON estático -> Firebase)...');

  try {
    // 1. Buscar registros no histórico onde a polyline existe mas a URL do GeoJSON não
    // Certifique-se de que a coluna `map_geojson_url` já foi adicionada ao seu schema.ts e ao BD!
    const records = await db.execute(sql`
      SELECT id, athlete_id, map_polyline as polyline
      FROM workout_sessions 
      WHERE map_polyline IS NOT NULL AND map_geojson_url IS NULL
    `);

    console.log(`🔍 Encontrados ${records.rows.length} registros para processamento.`);

    const bucket = mapApp.storage().bucket();
    let processed = 0;

    for (const record of records.rows) {
      const { id, athlete_id, polyline: encodedPolyline } = record;

      try {
        console.log(`⚙️ Processando GeoJSON do registro: ${id} (Atleta: ${athlete_id})`);

        // 2. Decodifica a string da polyline para um array de [Lat, Lng]
        const decodedCoords = polyline.decode(encodedPolyline as string);

        // 3. Monta a estrutura GeoJSON Padrão invertendo para [Lng, Lat] (Padrão RFC 7946)
        const geoJsonStructure = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {
                workout_id: id,
                athlete_id: athlete_id,
                stroke: "#ff0000",
                "stroke-width": 3
              },
              geometry: {
                type: "LineString",
                coordinates: decodedCoords.map(coord => [coord[1], coord[0]]) 
              }
            }
          ]
        };

        // 4. Converte em Buffer
        const jsonBuffer = Buffer.from(JSON.stringify(geoJsonStructure), 'utf-8');

        // 5. Upload do buffer para o Firebase Storage
        const filePath = `geojson-maps/${athlete_id}/${id}.geojson`;
        const file = bucket.file(filePath);

        await file.save(jsonBuffer, {
          metadata: { 
            contentType: 'application/geo+json',
            cacheControl: 'public, max-age=31536000' 
          },
        });

        // 6. Tornar arquivo público, resgatar a URL e atualizar o banco
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

        await db.execute(sql`UPDATE workout_sessions SET map_geojson_url = ${publicUrl} WHERE id = ${id}`);
        console.log(`✅ Sucesso! GeoJSON salvo em: ${publicUrl}`);
        processed++;
      } catch (err) {
        console.error(`❌ Erro processando GeoJSON do registro ${id}:`, err);
      }

      // Delay sutil para não sobrecarregar a rede ou ser bloqueado por rate limits do Google Cloud
      await delay(200);
    }

    console.log(`🎉 Backfill Concluído! ${processed}/${records.rows.length} arquivos GeoJSON gerados.`);
    setTimeout(() => process.exit(0), 500);
  } catch (error) {
    console.error('💥 Erro fatal no script de sincronização de GeoJSON:', error);
    setTimeout(() => process.exit(1), 500);
  }
}

syncHistoricalGeoJSON();