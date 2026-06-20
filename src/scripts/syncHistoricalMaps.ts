import { db } from '@/db';
import { sql } from 'drizzle-orm';
import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import '@/config/env'; // <-- Correção Tática: Garante o carregamento do .env central do projeto

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
const serviceAccount = require(serviceAccountPath);

// Inicialização Secundária do Firebase (Motor Cartográfico/Mapas)
const mapApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_MAP_STORAGE_BUCKET
}, 'mapApp');

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function syncHistoricalMaps() {
  console.log('🚀 Iniciando Backfill Cartográfico (MapTiler -> Firebase MapApp)...');

  try {
    // 2. Buscar registros no histórico onde a polyline existe mas a imagem não
    const records = await db.execute(sql`
      SELECT id, athlete_id, map_polyline as polyline
      FROM workout_sessions 
      WHERE map_polyline IS NOT NULL AND map_image_url IS NULL
    `);

    console.log(`🔍 Encontrados ${records.rows.length} registros para processamento.`);

    const bucket = mapApp.storage().bucket();
    const mapsBaseUrl = process.env.MAPS_BASE_URL;
    const mapsApiKey = process.env.MAPS_API_KEY;

    if (!mapsBaseUrl || !mapsApiKey) {
      throw new Error('❌ Faltam as credenciais do MapTiler (MAPS_BASE_URL ou MAPS_API_KEY) no .env');
    }

    let processed = 0;

    for (const record of records.rows) {
      const { id, athlete_id, polyline } = record;

      try {
        console.log(`⚙️ Processando registro: ${id} (Atleta: ${athlete_id})`);

        // 3. Construir URL do MapTiler
        // Codifica todo o valor do parâmetro 'path', garantindo que os caracteres como '|' fiquem URL-safe (%7C)
        const pathParam = encodeURIComponent(`stroke:red|width:3|enc:${polyline as string}`);
        const maptilerUrl = `${mapsBaseUrl}/auto/500x300.png?key=${mapsApiKey}&path=${pathParam}`;

        // 4. Fetch do buffer da imagem
        const response = await fetch(maptilerUrl);
        if (!response.ok) {
          const contentType = response.headers.get('content-type') || '';
          let errorText = 'Sem detalhes adicionais';
          
          if (contentType.includes('image')) {
            errorText = '[Imagem de erro retornada pela API (Corpo Binário bloqueado pelo parser)]';
            await response.arrayBuffer(); // Consome o corpo para liberar a memória e limpar a stream
          } else {
            errorText = await response.text().catch(() => 'Erro ao ler texto da resposta');
          }
          
          const safeUrl = maptilerUrl.replace(mapsApiKey, '***CHAVE_OCULTA***');
          console.error(`❌ Erro no MapTiler para o registro ${id}: ${response.status} ${response.statusText}`);
          console.error(`   Detalhes da API: ${errorText}`);
          console.error(`   URL Tentada: ${safeUrl}\n`);
          continue;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        // 5. Upload do buffer para o Firebase secundário (mapApp)
        const filePath = `maps/${athlete_id}/${id}.png`;
        const file = bucket.file(filePath);

        await file.save(imageBuffer, {
          metadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000' },
        });

        // 6. Tornar arquivo público e capturar a URL e Atualizar Neon DB
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

        await db.execute(sql`UPDATE workout_sessions SET map_image_url = ${publicUrl} WHERE id = ${id}`);
        console.log(`✅ Sucesso! Mapa salvo em: ${publicUrl}`);
        processed++;
      } catch (err) {
        console.error(`❌ Erro processando registro ${id}:`, err);
      }

      // 7. Delay de 1.5s (Prevenir Rate Limit do provedor de mapas)
      await delay(1500);
    }

    console.log(`🎉 Backfill Concluído! ${processed}/${records.rows.length} mapas gerados.`);
    
    // Hack tático para Windows: Aguarda o I/O de rede e BD fechar suavemente antes de derrubar o processo
    setTimeout(() => process.exit(0), 500);
  } catch (error) {
    console.error('💥 Erro fatal no script de sincronização:', error);
    setTimeout(() => process.exit(1), 500);
  }
}

syncHistoricalMaps();