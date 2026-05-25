// Arquivo: src/services/pdfGeneratorService.ts
import PDFDocument from 'pdfkit';
import { eq, and, between, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { env } from '@/config/env';
import { workoutSessions, treadmillIntervals, bioimpedanceLogs, races, plannedWorkouts } from '@/db/schema';

function decodePolyline(str: string, p = 5): [number, number][] {
  let idx = 0, lat = 0, lng = 0, coords: [number, number][] = [], factor = Math.pow(10, p);
  while (idx < str.length) {
    let b, shift = 0, res = 0;
    do { b = str.charCodeAt(idx++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += ((res & 1) ? ~(res >> 1) : (res >> 1));
    shift = res = 0;
    do { b = str.charCodeAt(idx++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += ((res & 1) ? ~(res >> 1) : (res >> 1));
    coords.push([lat / factor, lng / factor]);
  }
  return coords;
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
          doc.fontSize(12).fillColor('black').text(`${idx + 1}. ${r.name || r.category} (${r.distance}km) - ${r.date.toLocaleDateString('pt-BR')}`);
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

  return new Promise((resolve, reject) => {
    const Doc = typeof PDFDocument === 'function' ? PDFDocument : (PDFDocument as any).default || PDFDocument;
    const doc = new Doc({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(20).text('KINETIX HUB - Prontuário de Prova', { align: 'center' }).moveDown();
    doc.fontSize(16).text(`${race.name || race.category} - ${race.distance}km`, { align: 'center' }).moveDown();
    
    doc.fontSize(12).text(`Data: ${race.date.toLocaleDateString('pt-BR')}`);
    doc.text(`Local da Largada: ${race.startLocation}`);
    if (race.weather) {
      doc.text(`Clima na Largada: ${race.weather}`);
    }
    doc.text(`Categoria: ${race.category}`);
    doc.text(`Tempo de Prova: ${timeStr}`);
    doc.text(`Pace Médio: ${paceStr}`).moveDown(2);

    if (race.polyline) {
      doc.fontSize(14).text('Traçado do Percurso (GPS):').moveDown(1);
      
      const startX = doc.x;
      const startY = doc.y;
      const chartWidth = 400;
      const chartHeight = 250;
      
      doc.rect(startX, startY, chartWidth, chartHeight).fillAndStroke('#f3f4f6', '#e5e7eb');
      const coords = decodePolyline(race.polyline);
      if (coords.length > 0) {
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const [lat, lng] of coords) {
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        }
        const latRange = maxLat - minLat || 1;
        const lngRange = maxLng - minLng || 1;
        doc.lineWidth(3).strokeColor('#fc4c02');
        const margin = 10, innerWidth = chartWidth - margin * 2, innerHeight = chartHeight - margin * 2;
        coords.forEach(([lat, lng], i) => {
          const px = startX + margin + ((lng - minLng) / lngRange) * innerWidth;
          const py = startY + margin + innerHeight - ((lat - minLat) / latRange) * innerHeight;
          if (i === 0) doc.moveTo(px, py); else doc.lineTo(px, py);
        });
        doc.stroke();
      }
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
        const dateStr = w.date.toLocaleDateString('pt-BR');
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
        if (w.details && typeof w.details === 'object') {
          detailsStr = Object.entries(w.details).map(([k, v]) => `${k}: ${v}`).join(' | ');
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

      doc.fontSize(12).fillColor('black').text(`${idx + 1}. ${r.date.toLocaleDateString('pt-BR')} - ${r.name || r.category}`);
      doc.fontSize(10).fillColor('#4b5563').text(`    Distância: ${r.distance}km | Tempo: ${timeStr} | Local: ${r.startLocation}`);
      if (r.weather) doc.text(`    Clima: ${r.weather}`);
      doc.moveDown(0.5);
    });

    doc.end();
  });
}