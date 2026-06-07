// Arquivo: src/services/pdfGeneratorService.ts
import PDFDocument from 'pdfkit';
import { eq, and, between, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { env } from '@/config/env';
import { workoutSessions, treadmillIntervals, bioimpedanceLogs, races, plannedWorkouts } from '@/db/schema';
import { redisClient } from '@/config/redis';

// Fallback de cache local caso o Redis não esteja configurado
const localMapCache = new Map<string, Buffer>();

export async function fetchMapStaticBuffer(polyline: string): Promise<Buffer | null> {
  if (!env.MAPSTATIC_URL || !polyline) return null;
  
  const cacheKey = `map:polyline:${polyline}`;

  // 1. Tenta buscar no cache distribuído (Redis) ou local
  if (redisClient) {
    try {
      const cachedBuffer = await redisClient.getBuffer(cacheKey); // Usar getBuffer para binários!
      if (cachedBuffer) return cachedBuffer;
    } catch (err) {
      console.error('❌ [Redis] Erro ao ler cache de mapa:', err);
    }
  } else if (localMapCache.has(polyline)) {
    return localMapCache.get(polyline)!;
  }

  try {
    // 2. Se não estiver no cache, aciona o Motor MapStatic
    const url = new URL(env.MAPSTATIC_URL);
    url.searchParams.append('path', `weight:3|color:0xff0000ff|enc:${polyline}`);
    url.searchParams.append('size', '600x300');
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 3. Salva a imagem processada no cache (TTL 30 Dias)
    if (redisClient) await redisClient.set(cacheKey, buffer, 'EX', 60 * 60 * 24 * 30).catch(console.error);
    else localMapCache.set(polyline, buffer);

    return buffer;
  } catch (error) {
    console.error('❌ [MapStatic] Erro de rede interna:', error);
    return null;
  }
}

export async function generatePhysiologicalXRayPDF(athleteId: string, month: number, year: number): Promise<Buffer> {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // 1. Busca Carga de Treino Acumulada
    const sessions = await db.select().from(workoutSessions).where(
      and(eq(workoutSessions.athleteId, athleteId), between(workoutSessions.date, startDate, endDate))
    );

    const totalDuration = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
    const sessionIds = sessions.map(s => s.id);
    
    let totalDistanceMeters = 0;
    if (sessionIds.length > 0) {
      const intervals = await db.select().from(treadmillIntervals)
        .where(inArray(treadmillIntervals.sessionId, sessionIds));
      totalDistanceMeters = intervals.reduce((acc, i) => acc + i.distanceMeters, 0);
    }
    const totalKms = (totalDistanceMeters / 1000).toFixed(2);

    // 2. Busca Adaptação Metabólica
    const bioLogs = await db.select().from(bioimpedanceLogs).where(
      and(eq(bioimpedanceLogs.athleteId, athleteId), between(bioimpedanceLogs.date, startDate, endDate))
    ).orderBy(bioimpedanceLogs.date);

    let bioText = "Nenhum registro de bioimpedância no período.";
    if (bioLogs.length > 0) {
      const first = bioLogs[0];
      const last = bioLogs[bioLogs.length - 1];
      const weightDiff = (last.weight - first.weight).toFixed(2);
      const fatDiff = (last.bodyFat - first.bodyFat).toFixed(2);
      bioText = `Peso Atual: ${last.weight}kg (Variação: ${weightDiff}kg)\n` +
                `% Gordura Atual: ${last.bodyFat}% (Variação: ${fatDiff}%)\n` +
                `Massa Muscular Atual: ${last.muscleMass}kg`;
    }

    // 3. Busca Provas do Mês
    const monthRaces = await db.select().from(races).where(
      between(races.date, startDate, endDate)
    ).orderBy(races.date);

    // 4. Montagem do PDF
    return new Promise((resolve, reject) => {
      // Fallback de construtor para lidar com diferenças de CJS/ESM
      const Doc = typeof PDFDocument === 'function' ? PDFDocument : (PDFDocument as any).default || PDFDocument;
      const doc = new Doc({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.fontSize(20).text('KINETIX HUB - Raio-X Fisiológico Mensal', { align: 'center' }).moveDown();
      doc.fontSize(14).text(`Período: ${month.toString().padStart(2, '0')}/${year}`, { align: 'center' }).moveDown(2);

      doc.fontSize(16).text('Seção 1: Carga de Treino Acumulada').moveDown(0.5);
      doc.fontSize(12).text(`Sessões Concluídas: ${sessions.length}`);
      doc.text(`Volume Total (Minutos): ${totalDuration} min`);
      doc.text(`Distância Total na Esteira: ${totalKms} km`).moveDown(1);

      // ==========================================
      // INJEÇÃO DO GRÁFICO DE BARRAS NATIVO
      // ==========================================
      if (sessions.length > 0) {
        doc.fontSize(12).text('Evolução do Volume por Treino (Minutos):').moveDown(0.5);
        
        const startX = doc.x;
        const startY = doc.y;
        const chartWidth = 400;
        const chartHeight = 100;
        
        const maxVal = Math.max(...sessions.map(s => s.durationMinutes), 1);
        const barWidth = Math.min((chartWidth / sessions.length) - 10, 40); // Largura máxima de 40

        sessions.forEach((session, i) => {
          const barHeight = (session.durationMinutes / maxVal) * chartHeight;
          const x = startX + i * (barWidth + 10);
          const y = startY + chartHeight - barHeight;

          // Desenha a barra (Azul Kinetix)
          doc.rect(x, y, barWidth, barHeight).fill('#3b82f6');
          
          // Textos e Eixos
          doc.fillColor('black').fontSize(8).text(session.durationMinutes.toString(), x, y - 12, { width: barWidth, align: 'center' });
          doc.text(`T${i + 1}`, x, startY + chartHeight + 5, { width: barWidth, align: 'center' });
        });
        doc.y = startY + chartHeight + 30; // Move o cursor para baixo do gráfico
      }

      doc.fontSize(16).text('Seção 2: Adaptação Metabólica').moveDown(0.5);
      doc.fontSize(12).text(bioText);

      doc.moveDown(2);
      doc.fontSize(16).text('Seção 3: Provas e Competições').moveDown(0.5);
      if (monthRaces.length > 0) {
        monthRaces.forEach((r, idx) => {
          doc.fontSize(12).fillColor('black').text(`${idx + 1}. ${r.name || r.category} (${r.distance}km) - ${r.date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
          doc.fontSize(10).fillColor('#4b5563').text(`   Local: ${r.startLocation} | Clima: ${r.weather || 'N/A'}`);
          if (r.movingTime) {
            const h = Math.floor(r.movingTime / 3600);
            const m = Math.floor((r.movingTime % 3600) / 60);
            doc.text(`   Tempo Oficial: ${h}h ${m}m`);
          }
          doc.moveDown(0.5);
        });
      } else {
        doc.fontSize(12).fillColor('black').text('Nenhuma prova disputada neste período.');
      }

      doc.end();
    });
  } catch (error) {
    console.error('❌ [PDF SERVICE] Falha na busca de dados ou estruturação:', error);
    throw error;
  }
}

export async function generateRaceReportPDF(raceId: string): Promise<Buffer> {
  const raceResult = await db.select().from(races).where(eq(races.id, raceId)).limit(1);
  const race = raceResult[0];
  if (!race) throw new Error("Prova não encontrada");

  let timeStr = "--:--:--";
  let paceStr = "--:-- /km";
  if (race.movingTime && race.distance > 0) {
    const hours = Math.floor(race.movingTime / 3600);
    const minutes = Math.floor((race.movingTime % 3600) / 60);
    const seconds = race.movingTime % 60;
    timeStr = [hours, minutes, seconds].map(v => v.toString().padStart(2, '0')).join(':');

    const paceDecimal = (race.movingTime / 60) / race.distance;
    const paceMins = Math.floor(paceDecimal);
    const paceSecs = Math.round((paceDecimal - paceMins) * 60);
    paceStr = `${paceMins}:${paceSecs.toString().padStart(2, '0')} /km`;
  }

  let mapBuffer: Buffer | null = null;
  if (race.polyline) {
    mapBuffer = await fetchMapStaticBuffer(race.polyline);
  }

  return new Promise((resolve, reject) => {
    const Doc = typeof PDFDocument === 'function' ? PDFDocument : (PDFDocument as any).default || PDFDocument;
    const doc = new Doc({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(20).text('KINETIX HUB - Prontuário de Prova', { align: 'center' }).moveDown();
    doc.fontSize(16).text(`${race.name || race.category} - ${race.distance}km`, { align: 'center' }).moveDown();
    
    doc.fontSize(12).text(`Data: ${race.date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    doc.text(`Local da Largada: ${race.startLocation}`);
    if (race.weather) {
      doc.text(`Clima na Largada: ${race.weather}`);
    }
    if (race.elevationGain) {
      doc.text(`Altimetria (Ganho de Elevação): +${race.elevationGain}m`);
    }
    doc.text(`Categoria: ${race.category}`);
    doc.text(`Tempo de Prova: ${timeStr}`);
    doc.text(`Pace Médio: ${paceStr}`).moveDown(2);

    if (race.polyline) {
      doc.fontSize(14).text('Traçado do Percurso (Soberania Cartográfica / MapStatic):').moveDown(1);
      if (mapBuffer) {
        doc.image(mapBuffer, { fit: [450, 250], align: 'center' });
      } else {
        doc.fillColor('red').text('Mapa indisponível na rede interna.', { align: 'center' }).fillColor('black');
      }
    }
    doc.end();
  });
}

export async function generateLogbookPDF(athleteId: string, startDate: Date, endDate: Date): Promise<Buffer> {
  const workouts = await db.select().from(plannedWorkouts).where(
    and(
      eq(plannedWorkouts.athleteId, athleteId),
      between(plannedWorkouts.date, startDate, endDate)
    )
  ).orderBy(plannedWorkouts.date);

  let validated = 0;
  let completedNotValidated = 0;
  let missed = 0;

  const now = new Date();

  workouts.forEach(w => {
    if (w.complianceStatus === 'VALIDATED') validated++;
    else if (w.complianceStatus === 'COMPLETED_NOT_VALIDATED') completedNotValidated++;
    else if (w.complianceStatus === 'MISSED') missed++;
    else if (!w.complianceStatus && w.date.getTime() < now.getTime()) missed++; // Passou e não registrou
  });

  const totalEvaluated = validated + completedNotValidated + missed;
  const valPct = totalEvaluated > 0 ? (validated / totalEvaluated) * 100 : 0;
  const cnvPct = totalEvaluated > 0 ? (completedNotValidated / totalEvaluated) * 100 : 0;
  const missedPct = totalEvaluated > 0 ? (missed / totalEvaluated) * 100 : 0;

  return new Promise((resolve, reject) => {
    const Doc = typeof PDFDocument === 'function' ? PDFDocument : (PDFDocument as any).default || PDFDocument;
    const doc = new Doc({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(20).text('KINETIX HUB - Logbook Tático', { align: 'center' }).moveDown();
    doc.fontSize(14).text(`Período de Avaliação: ${startDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} a ${endDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, { align: 'center' }).moveDown(2);

    // GRÁFICO VETORIAL DE ADERÊNCIA (STACKED BAR)
    doc.fontSize(16).fillColor('black').text('Aderência ao Plano (Compliance)').moveDown(1);
    
    const startX = doc.x;
    const startY = doc.y;
    const barWidth = 400;
    const barHeight = 25;

    if (totalEvaluated > 0) {
      const valW = (valPct / 100) * barWidth;
      const cnvW = (cnvPct / 100) * barWidth;
      const missW = (missedPct / 100) * barWidth;

      doc.rect(startX, startY, valW, barHeight).fill('#10b981'); // Verde
      doc.rect(startX + valW, startY, cnvW, barHeight).fill('#f59e0b'); // Laranja/Amarelo
      doc.rect(startX + valW + cnvW, startY, missW, barHeight).fill('#ef4444'); // Vermelho

      doc.y = startY + barHeight + 15;
      doc.fillColor('#10b981').rect(startX, doc.y, 10, 10).fill().fillColor('black').fontSize(10).text(`VALIDATED (${validated} - ${valPct.toFixed(1)}%)`, startX + 15, doc.y - 1);
      doc.y += 15;
      doc.fillColor('#f59e0b').rect(startX, doc.y, 10, 10).fill().fillColor('black').text(`COMPLETED NOT VALIDATED (${completedNotValidated} - ${cnvPct.toFixed(1)}%)`, startX + 15, doc.y - 1);
      doc.y += 15;
      doc.fillColor('#ef4444').rect(startX, doc.y, 10, 10).fill().fillColor('black').text(`MISSED (${missed} - ${missedPct.toFixed(1)}%)`, startX + 15, doc.y - 1);
    } else {
      doc.fontSize(12).text('Nenhum treino avaliado no período.');
    }

    doc.moveDown(2);
    doc.fontSize(16).fillColor('black').text('Relatório de Desvios Táticos').moveDown(0.5);
    const desvios = workouts.filter(w => w.complianceStatus === 'COMPLETED_NOT_VALIDATED' || w.complianceStatus === 'MISSED' || (!w.complianceStatus && w.date.getTime() < now.getTime()));
    
    if (desvios.length === 0) {
      doc.fontSize(10).fillColor('#10b981').text('Excelente! Nenhum desvio tático registrado no período.');
    } else {
      desvios.forEach(d => {
        const status = d.complianceStatus || 'MISSED';
        doc.fontSize(10).fillColor(status === 'MISSED' ? '#ef4444' : '#f59e0b').text(`[${status}] `, { continued: true }).fillColor('black').text(`${d.date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} - ${d.title}`);
        doc.moveDown(0.2);
      });
    }
    doc.end();
  });
}

export async function generatePlanPDF(athleteId: string): Promise<Buffer> {
  const workouts = await db.select().from(plannedWorkouts)
    .where(eq(plannedWorkouts.athleteId, athleteId))
    .orderBy(plannedWorkouts.date);

  return new Promise((resolve, reject) => {
    const Doc = typeof PDFDocument === 'function' ? PDFDocument : (PDFDocument as any).default || PDFDocument;
    const doc = new Doc({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('black').text('KINETIX HUB - Planilha de Treinamento', { align: 'center' }).moveDown(2);

    if (workouts.length === 0) {
      doc.fontSize(12).text('Nenhum treino planejado encontrado no banco de dados.');
    } else {
      workouts.forEach((w, idx) => {
        const dateStr = w.date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        let emoji = '💤';
        if (w.activityType === 'RUN') emoji = '🏃‍♂️';
        else if (w.activityType === 'BIKE') emoji = '🚴‍♂️';
        else if (w.activityType === 'STRENGTH') emoji = '🏋️‍♂️';

        let statusBadge = '';
        if (w.complianceStatus === 'VALIDATED') statusBadge = ' [✅ Cumprido]';
        else if (w.complianceStatus === 'COMPLETED_NOT_VALIDATED') statusBadge = ' [❌ Fora da Meta]';
        // Marca como pendente/atrasado caso a data da atividade já tenha passado e ela não tenha status
        else if (!w.complianceStatus && w.date.getTime() < Date.now()) statusBadge = ' [⚠️ Pendente]';

        doc.fontSize(12).fillColor('black').text(`${idx + 1}. ${dateStr} - ${emoji} ${w.activityType}: ${w.title}${statusBadge}`);
        
        let detailsStr = '';
        let parsedDetails = w.details;
        if (typeof parsedDetails === 'string') {
          try { parsedDetails = JSON.parse(parsedDetails); } catch (e) { console.error('[PDF Engine] Erro de parser JSONB:', e); }
        }
        
        if (parsedDetails && typeof parsedDetails === 'object') {
          detailsStr = Object.entries(parsedDetails).map(([k, v]) => `${k}: ${v}`).join(' | ');
        }
        
        if (detailsStr) {
          doc.fontSize(10).fillColor('#4b5563').text(`    Detalhes: ${detailsStr}`);
        }
        doc.moveDown(0.5);
      });
    }

    doc.end();
  });
}

export async function generateCareerReportPDF(): Promise<Buffer> {
  const allRaces = await db.select().from(races).orderBy(races.date);

  let prRecords: Array<{
    year: number;
    distance_target: string;
    durationMinutes: number;
    distance: number;
    weather?: string;
    mapPolyline?: string;
    mapImageBuffer?: Buffer | null;
  }> = [];
  try {
    const prRecordsResult = await db.execute(sql`
      WITH ActivityPRs AS (
        SELECT 
          id,
          EXTRACT(YEAR FROM date) AS year,
          distance,
          "durationMinutes",
          "map_polyline" AS mapPolyline,
          weather,
          CASE 
            WHEN distance >= 9.5 AND distance <= 10.5 THEN '10km'
            WHEN distance >= 20.5 AND distance <= 22.0 THEN '21km'
            WHEN distance >= 41.5 THEN '42km'
          END AS distance_target
        FROM workout_sessions
        WHERE "activityType" = 'RUN' AND "durationMinutes" IS NOT NULL
      ), 
      RankedPRs AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY year, distance_target ORDER BY "durationMinutes" ASC) as rank
        FROM ActivityPRs
        WHERE distance_target IS NOT NULL
      )
      SELECT * FROM RankedPRs WHERE rank = 1 ORDER BY year DESC, distance_target ASC;
    `);
    prRecords = (prRecordsResult.rows || prRecordsResult) as typeof prRecords;
    for (const pr of prRecords) {
      if (pr.mapPolyline) pr.mapImageBuffer = await fetchMapStaticBuffer(pr.mapPolyline);
    }
  } catch (err) {
    console.error('Erro ao buscar PRs com Polylines:', err);
  }

  return new Promise((resolve, reject) => {
    const Doc = typeof PDFDocument === 'function' ? PDFDocument : (PDFDocument as any).default || PDFDocument;
    const doc = new Doc({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('black').text('KINETIX HUB - Dossiê Histórico de Carreira', { align: 'center' }).moveDown(2);

    const totalRaces = allRaces.length;
    const totalDistance = allRaces.reduce((acc, r) => acc + r.distance, 0).toFixed(2);
    const cities = new Set(allRaces.map(r => r.startLocation)).size;

    doc.fontSize(16).text('Estatísticas Globais (Strava)').moveDown(0.5);
    doc.fontSize(12).text(`Total de Provas: ${totalRaces}`);
    doc.text(`Distância Acumulada: ${totalDistance} km`);
    doc.text(`Cidades Conquistadas: ${cities}`).moveDown(2);

    doc.fontSize(16).text('Histórico Detalhado').moveDown(0.5);

    allRaces.forEach((r, idx) => {
      let timeStr = "--:--:--";
      if (r.movingTime) {
        const h = Math.floor(r.movingTime / 3600);
        const m = Math.floor((r.movingTime % 3600) / 60);
        const s = r.movingTime % 60;
        timeStr = [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
      }

      doc.fontSize(12).fillColor('black').text(`${idx + 1}. ${r.date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} - ${r.name || r.category}`);
      doc.fontSize(10).fillColor('#4b5563').text(`    Distância: ${r.distance}km | Tempo: ${timeStr} | Local: ${r.startLocation}`);
      if (r.weather) doc.text(`    Clima: ${r.weather}`);
      doc.moveDown(0.5);
    });

    if (prRecords.length > 0) {
      doc.addPage();
      doc.fontSize(16).fillColor('black').text('Marcas de Combate (PR) com Soberania Cartográfica', { underline: true });
      doc.moveDown(1);
      for (const pr of prRecords) {
        doc.fontSize(12).font('Helvetica-Bold').text(`${pr.year} - ${pr.distance_target}`);
        doc.font('Helvetica').text(`Tempo Oficial: ${pr.durationMinutes} minutos | Distância Apurada: ${pr.distance} km${pr.weather ? ` | Clima: ${pr.weather}` : ''}`);
        doc.moveDown(0.5);
        if (pr.mapImageBuffer) {
          doc.image(pr.mapImageBuffer, { fit: [450, 200], align: 'center' });
        } else {
          doc.fillColor('red').text('Mapa indisponível na rede interna.', { align: 'center' }).fillColor('black');
        }
        doc.moveDown(2);
      }
    }

    doc.end();
  });
}

export async function generateStrengthAuditPDF(sessionId: string): Promise<Buffer> {
  // TODO: Conectar lógica avançada de Cruzamento IronLog (Planejado vs Realizado)
  // Retorna documento Base para suprimir erro 404/500 caso a rota seja chamada antecipadamente
  return new Promise((resolve, reject) => {
    const Doc = typeof PDFDocument === 'function' ? PDFDocument : (PDFDocument as any).default || PDFDocument;
    const doc = new Doc({ margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('black').text('KINETIX HUB - Auditoria de Força (IronLog)', { align: 'center' }).moveDown(2);
    doc.fontSize(12).text(`Sessão ID: ${sessionId}`);
    doc.text('Relatório em construção. O Head Coach está calibrando a telemetria de cargas.');
    doc.end();
  });
}